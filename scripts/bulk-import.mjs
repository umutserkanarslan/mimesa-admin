// Mi Mesa — bulk import from Mi_Mesa_Menu.xlsx
//
// Modes:
//   --dry-run   Parse Excel, show plan. No API calls, no writes. (default)
//   --probe     Process the first 2 items end-to-end (translate + image
//               + storage upload + DB insert). Existing data untouched.
//               Useful for sanity-checking style + costs.
//   --commit    WIPE every existing category/item/storage object, then
//               import all 13 categories + 132 items from scratch.
//
// Usage:
//   node --env-file=.env scripts/bulk-import.mjs --dry-run
//   node --env-file=.env scripts/bulk-import.mjs --probe
//   node --env-file=.env scripts/bulk-import.mjs --commit
//
// Env required: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY

import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------- config

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXCEL_PATH = path.resolve(HERE, '..', 'Mi_Mesa_Menu.xlsx');
const STORAGE_BUCKET = 'menu-images';
const IMAGE_QUALITY = 'medium'; // 'low' | 'medium' | 'high'
const IMAGE_CONCURRENCY = 3;

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_KEY) {
	console.error('Missing env: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
	process.exit(1);
}

const args = new Set(process.argv.slice(2));
const MODE = args.has('--commit') ? 'commit' : args.has('--probe') ? 'probe' : 'dry-run';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false }
});
const openai = new OpenAI({ apiKey: OPENAI_KEY });

// -------------------------------------------------------------- slugify

const TURKISH_MAP = {
	ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i',
	ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u'
};
function slugify(input) {
	if (!input) return '';
	let out = '';
	for (const ch of input) out += TURKISH_MAP[ch] ?? ch;
	return out
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------- Excel + notes parsing

/**
 * Parse the "Notlar / Açıklamalar" column.
 * Returns { priceLabels: [a, b] | null, info: string | null }.
 *
 * Examples:
 *   "Fiyatlar: Az / Tam"          → labels=["Az","Tam"], info=null
 *   "Fiyatlar: 1 / 1.5 Porsiyon"  → labels=["1 Porsiyon","1.5 Porsiyon"], info=null
 *   "Şefe sorunuz. Fiyatlar: Az / Tam" → labels=["Az","Tam"], info="Şefe sorunuz."
 *   "minimum 2 kişilik (Porsiyon yok)" → labels=null, info="minimum 2 kişilik"
 *   "(Porsiyon yok)"              → labels=null, info=null
 */
function parseNotes(notes) {
	if (!notes) return { priceLabels: null, info: null };
	let text = String(notes).trim();
	let priceLabels = null;

	// "Fiyatlar: X / Y" — match until end of string or a trailing parenthetical.
	// Don't stop at "." because "1.5" has one.
	const priceMatch = text.match(/Fiyatlar?\s*:\s*(.+?)(?:\s*\([^)]*\)\s*$|\s*$)/i);
	if (priceMatch) {
		const inner = priceMatch[1].trim();
		const parts = inner.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
		if (parts.length === 2) {
			const a = parts[0];
			const b = parts[1];
			// "1" / "1.5 Porsiyon" → "1 Porsiyon" / "1.5 Porsiyon"
			const bSuffix = b.match(/^([\d.,]+)\s+(.+)$/);
			if (bSuffix && /^[\d.,]+$/.test(a)) {
				priceLabels = [`${a} ${bSuffix[2]}`, b];
			} else {
				priceLabels = [a, b];
			}
		}
		text = text.replace(priceMatch[0], '').trim();
	}

	// "Porsiyonlar: ..." — 3-portion metadata we can't represent; drop it.
	text = text.replace(/Porsiyonlar?\s*:[^()]*/i, '').trim();

	// Strip "(Porsiyon yok)" and other parenthetical metadata
	text = text.replace(/\(Porsiyon yok\)/gi, '').trim();

	// Trim trailing/leading punctuation and whitespace WITHOUT eating Turkish letters.
	// (\W in JS treats "Ş", "ğ", "ı" as non-word, which would mangle "Şefe sorunuz".)
	text = text.replace(/[.,;:!?\s]+$/g, '').replace(/^[.,;:!?\s]+/g, '').replace(/\s{2,}/g, ' ').trim();

	return { priceLabels, info: text || null };
}

function loadExcel() {
	const wb = xlsxRead(readFileSync(EXCEL_PATH));
	const rows = xlsxUtils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

	const categoriesMap = new Map(); // slug → { name, items: [] }
	const items = [];

	for (let i = 0; i < rows.length; i++) {
		const r = rows[i];
		const catNameRaw = String(r['Kategori'] || '').trim();
		const itemNameRaw = String(r['Ürün Adı'] || '').trim();
		if (!catNameRaw || !itemNameRaw) continue;

		const catSlug = slugify(catNameRaw);
		if (!categoriesMap.has(catSlug)) {
			categoriesMap.set(catSlug, {
				slug: catSlug,
				nameTr: titleCase(catNameRaw),
				rawName: catNameRaw,
				sortOrder: categoriesMap.size + 1,
				items: []
			});
		}

		const price1 = numOrNull(r['Fiyat 1 (Normal / Az / 1 Porsiyon)']);
		const price2 = numOrNull(r['Fiyat 2 (Tam / 1.5 Porsiyon)']);
		const notes = parseNotes(r['Notlar / Açıklamalar']);

		const cat = categoriesMap.get(catSlug);
		const itemSlug = uniqueSlug(slugify(itemNameRaw), cat.items.map((x) => x.slug));

		const item = {
			rowIndex: i,
			categorySlug: catSlug,
			slug: itemSlug,
			nameTr: titleCase(itemNameRaw),
			rawName: itemNameRaw,
			price: price1,
			priceAlt: price2,
			priceLabels: notes.priceLabels,
			info: notes.info,
			sortOrder: cat.items.length + 1
		};
		cat.items.push(item);
		items.push(item);
	}

	return {
		categories: Array.from(categoriesMap.values()),
		items
	};
}

function titleCase(s) {
	// "KAHVALTILAR" → "Kahvaltılar", "Mİ MESA SPECİALLER" → "Mi Mesa Specialler"
	return s
		.toLocaleLowerCase('tr-TR')
		.split(/\s+/)
		.map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1))
		.join(' ');
}

function numOrNull(v) {
	if (v === '' || v == null) return null;
	const n = Number(v);
	return Number.isFinite(n) && n > 0 ? n : null;
}

function uniqueSlug(base, taken) {
	if (!taken.includes(base)) return base;
	let i = 2;
	while (taken.includes(`${base}-${i}`)) i++;
	return `${base}-${i}`;
}

// ------------------------------------------------------------- OpenAI prompts

const TRANSLATE_SYSTEM = `Sen Mi Mesa adlı, Bodrum'da Anadolu ve Mezopotamya mutfağının modern yorumunu sunan fine-dining restoranın çevirmenisin. Marka sesi şudur:

- Şairane, hissi, editöryel; jenerik menü dilinden uzak
- Türkçe yemek/malzeme adlarını koru: isot, sumak, mantı, künefe, kadayıf, ayran, simit, kısır, çiğ köfte, mezopotamya
- Doğal, akıcı ve kısa cümleler
- "köy", "tandır", "bakır", "köz", "ateş" gibi duyusal kelimeleri tercüme ederken İngilizce/Arapça'da da dokuyu koru

Sana TR alanları (name, tagline, description'ın bir alt kümesi) JSON olarak verilecek. Her birini İngilizce (en) ve Arapça (ar) olarak çevir. Sadece sana verilen anahtarları döndür. Çıktı strict JSON:

{ "en": { ... }, "ar": { ... } }

Hiçbir açıklama, sadece JSON.`;

const ITEM_DESC_SYSTEM = `Sen Mi Mesa fine-dining restoranı için kısa, şairane menü açıklamaları yazıyorsun. Kurallar:

- Tam olarak 1-2 cümle, max 22 kelime
- Türkçe yemek/malzeme isimlerini koru
- Hissi ve duyusal kelimeler ("kömün sabrı", "ocaktan", "köz", "taze bahçeden", "günün hasadı") kullan
- Jenerik tarif değil; tabağa karakter ver
- Reklam dili yok, sıfat şişirmesi yok

Çıktı: Sadece açıklama metni. Tırnaksız, etiketsiz, açıklamasız.`;

const CATEGORY_META_SYSTEM = `Sen Mi Mesa fine-dining restoranı için kategori başlıklarına şairane TR alt başlık ve açıklama yazıyorsun. Kurallar:

- "tagline": Tam 2-5 kelimelik, italik gibi okunan şairane bir alt başlık (örn. "ateşin sabırlı dili", "mevsimin sessiz nefesi", "bir kuşaktan ötekine")
- "description": 1-2 cümle, max 28 kelime, kategoriyi tanımla; hissi kelimeler kullan ama abartma

Çıktı strict JSON:
{ "tagline": "...", "description": "..." }

Hiçbir açıklama, sadece JSON.`;

async function genItemDescription(nameTr, extraNote) {
	const userPrompt = extraNote
		? `${nameTr}\n(not: ${extraNote})`
		: nameTr;
	const r = await openai.chat.completions.create({
		model: 'gpt-4o-mini',
		temperature: 0.7,
		messages: [
			{ role: 'system', content: ITEM_DESC_SYSTEM },
			{ role: 'user', content: userPrompt }
		]
	});
	return (r.choices[0]?.message?.content ?? '').trim();
}

async function genCategoryMeta(nameTr) {
	const r = await openai.chat.completions.create({
		model: 'gpt-4o-mini',
		temperature: 0.7,
		response_format: { type: 'json_object' },
		messages: [
			{ role: 'system', content: CATEGORY_META_SYSTEM },
			{ role: 'user', content: nameTr }
		]
	});
	const raw = r.choices[0]?.message?.content ?? '{}';
	const parsed = JSON.parse(raw);
	return {
		tagline: String(parsed.tagline ?? '').trim(),
		description: String(parsed.description ?? '').trim()
	};
}

async function translate(input) {
	const cleaned = {};
	for (const [k, v] of Object.entries(input)) {
		if (typeof v === 'string' && v.trim()) cleaned[k] = v.trim();
	}
	if (!Object.keys(cleaned).length) return { en: {}, ar: {} };
	const r = await openai.chat.completions.create({
		model: 'gpt-4o-mini',
		temperature: 0.4,
		response_format: { type: 'json_object' },
		messages: [
			{ role: 'system', content: TRANSLATE_SYSTEM },
			{ role: 'user', content: JSON.stringify(cleaned) }
		]
	});
	const parsed = JSON.parse(r.choices[0]?.message?.content ?? '{}');
	return { en: parsed.en ?? {}, ar: parsed.ar ?? {} };
}

// ----------------------------------------------------------- image generation

// Hard rule applied to every image: this is a Turkish/Anatolian restaurant
// that does not serve alcohol. Models love to default to a wine glass or
// champagne flute as "fine dining" shorthand — explicitly forbid it.
const NO_ALCOHOL =
	'STRICTLY NO ALCOHOL: no wine, no champagne, no cocktail, no beer, no spirits, no stemmed wine/champagne glass, no liquor bottle anywhere in the frame.';

// Shared visual identity that every food image (no matter the plating
// style above) must share — lighting, surface, palette, palette, palette.
const IMAGE_STYLE_SUFFIX =
	'Shot at a roughly 45° angle, on a dark walnut wood table with a neutral linen napkin nearby and brushed copper cutlery. Soft natural window light from the left, shallow depth of field, photorealistic editorial food photography in the style of a fine-dining magazine. Warm muted palette of champagne (the color), copper and ink. No text, no labels, no logos. ' +
	NO_ALCOHOL;

const CATEGORY_STYLE_SUFFIX =
	'Editorial atmospheric food photography scene rooted in Anatolian / Eastern Mediterranean culture. Dark walnut table, soft natural window light, neutral linen, brushed copper. Use authentic Turkish props as appropriate to the chapter: tulip-shaped Turkish tea glass (ince belli çay bardağı) with steaming çay, brushed copper cezve, copper tray, hand-thrown ceramic bowls, simit, dried legumes, fresh herbs, ember-touched bread, charcoal, terracotta. Photorealistic, fine-dining ambience, warm muted palette of champagne (the color), copper and ink. No text, no labels, no logos. ' +
	NO_ALCOHOL;

function itemPrompt(item) {
	const isDrink = item.categorySlug === 'icecekler';
	const name = item.nameTr;
	const nameLc = name.toLocaleLowerCase('tr-TR');

	// Honour the dish's traditional plating instead of always using one round plate.
	let plating;
	if (isDrink) {
		plating = `A serving of "${name}" presented as a non-alcoholic beverage in an appropriate vessel (Turkish tea tulip glass for çay, copper mug for sahlep, plain tumbler for cold drinks, porcelain cup as fits the drink). Tight composition focused on the glass.`;
	} else if (/\bserpme\b/.test(nameLc)) {
		plating = `An overhead-leaning shot of a SERPME-style Anatolian breakfast spread: many small ceramic and copper plates and bowls covering a generous portion of the dark walnut table — white cheese, olives, fresh tomato and cucumber, eggs, simit, honey, butter, kaymak, jam, fresh herbs. Multiple plates, not a single composed plate. Tulip çay glass on a copper tray to the side. Composition reads as a family spread.`;
	} else if (/\bkünefe|kunefe\b/.test(nameLc)) {
		plating = `A serving of "${name}" in its traditional small copper sahan (round shallow pan), pistachio dust on top.`;
	} else if (/\bpide\b/.test(nameLc) || /\blahmacun\b/.test(nameLc)) {
		plating = `A serving of "${name}" on a long wooden board, ${nameLc.includes('lahmacun') ? 'thin and round, with a wedge of lemon' : 'boat-shaped flatbread'}.`;
	} else if (/\bdürüm\b/.test(nameLc)) {
		plating = `A serving of "${name}" rolled in lavash, sliced diagonally and stacked on a wooden board with pickles and onion sumak.`;
	} else if (/\b(çorba|corba)\b/.test(nameLc)) {
		plating = `A hand-thrown ceramic bowl of "${name}", steam rising, copper spoon resting beside it, a wedge of bread.`;
	} else if (/\b(kebap|şiş|sis|köfte|kofte)\b/.test(nameLc)) {
		plating = `A serving of "${name}" on an elongated rectangular plate with grilled vegetables, bulgur or rice, sumac onions.`;
	} else {
		plating = `A plated serving of "${name}" — a Turkish/Anatolian dish, presented on a hand-thrown matte ceramic plate.`;
	}

	return `${plating} ${IMAGE_STYLE_SUFFIX}`;
}

// Hint each category toward Anatolian props/atmosphere so the model has
// concrete imagery to reach for instead of defaulting to bar shorthand.
const CATEGORY_HINTS = {
	kahvaltilar: 'Anatolian Turkish breakfast culture: tulip-shaped çay glass on a copper tray, copper cezve, slices of simit, white cheese, olives, fresh tomato and cucumber, a small jar of honey.',
	tostlar: 'Toasted Turkish sandwich press culture: a wooden cutting board, gridded toast marks, a copper coffee pot in the background.',
	corbalar: 'Steam rising from a hand-thrown bowl of soup on a dark wood table, copper spoon, slice of crusty bread, dried red chilies.',
	salatalar: 'Fresh garden composition: hand-thrown bowl, leafy greens, pomegranate, sumac, olive oil cruet, brushed copper utensils.',
	extralar: 'Small assorted ceramic side bowls on a copper tray: pickles, olives, dips, rice, in soft window light.',
	'mi-mesa-specialler': 'Signature chef\'s composition: cast iron skillet or copper sahan, hand-thrown plate, single hero ingredient, smoke wisps, dramatic side light.',
	'mi-mesa-yoresel-lezzetler': 'Heirloom Anatolian village kitchen feel: clay pot, copper sahan, hand-stitched linen, dried herbs hanging in soft focus.',
	izgaralar: 'Charcoal grill atmosphere: glowing embers, skewers resting, smoke wisps, copper tongs, hand-thrown plate.',
	'odun-atesinden-lezzetler': 'Wood-fired oven atmosphere: stone hearth, glowing flames in the background, peel resting on the table, flour-dusted wooden surface.',
	pizzalar: 'Stone oven and wooden peel: flour-dusted wooden table, hand-thrown plate, herbs and dried tomatoes in soft focus.',
	'sefin-tavasindan': 'Chef\'s pan culture: hot copper sahan or cast iron skillet on the table, fresh herbs and lemon nearby, steam wisps.',
	durumler: 'Hand-rolled lavash culture: stacked thin lavash on linen, a copper rolling board, dried chilies, a tulip çay glass off to the side.',
	icecekler: 'Turkish drinks composition: tulip çay glass, copper tea kettle, a glass of ayran, a copper tray, condensation on a clear glass.'
};

function categoryPrompt(cat) {
	const hint = CATEGORY_HINTS[cat.slug] ?? '';
	return `${CATEGORY_STYLE_SUFFIX}\n\nChapter: "${cat.nameTr}". ${hint} Build a thematic moody hero composition that suggests the spirit of this menu chapter; you may show prep elements and supporting props but do not put a full plated entrée center stage.`;
}

async function genImage(prompt) {
	const r = await openai.images.generate({
		model: 'gpt-image-1',
		prompt,
		size: '1024x1024',
		quality: IMAGE_QUALITY,
		n: 1
	});
	const b64 = r.data[0].b64_json;
	return Buffer.from(b64, 'base64');
}

// ------------------------------------------------------------- supabase helpers

async function uploadBuffer(buffer, kind, slug) {
	const objectPath = `${kind}/${slug}.png`;
	const { error } = await supabase.storage
		.from(STORAGE_BUCKET)
		.upload(objectPath, buffer, {
			contentType: 'image/png',
			upsert: true,
			cacheControl: '31536000'
		});
	if (error) throw new Error(`Storage upload failed for ${objectPath}: ${error.message}`);
	const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
	return `${data.publicUrl}?v=${Date.now()}`;
}

async function wipeEverything() {
	console.log('🧹 Wiping items...');
	const { error: itemsErr } = await supabase.from('items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
	if (itemsErr) throw new Error(`Failed to wipe items: ${itemsErr.message}`);

	console.log('🧹 Wiping categories...');
	const { error: catsErr } = await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
	if (catsErr) throw new Error(`Failed to wipe categories: ${catsErr.message}`);

	console.log('🧹 Wiping storage objects...');
	for (const kind of ['items', 'categories']) {
		const { data: files } = await supabase.storage.from(STORAGE_BUCKET).list(kind, { limit: 1000 });
		if (files && files.length > 0) {
			const paths = files.map((f) => `${kind}/${f.name}`);
			const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
			if (error) console.warn(`  storage warning (${kind}): ${error.message}`);
			else console.log(`  removed ${paths.length} files from ${kind}/`);
		}
	}
}

async function insertCategory({ slug, name, tagline, description, cover, sortOrder }) {
	const { error } = await supabase.from('categories').upsert(
		{ slug, name, tagline, description, cover, sort_order: sortOrder },
		{ onConflict: 'slug' }
	);
	if (error) throw new Error(`Insert category ${slug} failed: ${error.message}`);
}

async function insertItem({ slug, categorySlug, name, description, price, priceLabel, priceAlt, priceAltLabel, image, sortOrder, isPublished }) {
	const { error } = await supabase.from('items').upsert(
		{
			slug,
			category_slug: categorySlug,
			name,
			description,
			price,
			price_label: priceLabel,
			price_alt: priceAlt,
			price_alt_label: priceAltLabel,
			currency: 'TRY',
			image,
			flags: [],
			sort_order: sortOrder,
			is_published: isPublished
		},
		{ onConflict: 'slug' }
	);
	if (error) throw new Error(`Insert item ${slug} failed: ${error.message}`);
}

// ------------------------------------------------------------- end-to-end ops

async function processCategory(cat) {
	console.log(`\n📁 Category: ${cat.nameTr} (${cat.slug})`);

	const meta = await genCategoryMeta(cat.nameTr);
	console.log(`   tagline: ${meta.tagline}`);
	console.log(`   description: ${meta.description}`);

	const translated = await translate({
		name: cat.nameTr,
		tagline: meta.tagline,
		description: meta.description
	});

	console.log(`   ⌛ generating cover image…`);
	const buffer = await genImage(categoryPrompt(cat));
	const url = await uploadBuffer(buffer, 'categories', cat.slug);
	console.log(`   ✓ ${url}`);

	await insertCategory({
		slug: cat.slug,
		name: { tr: cat.nameTr, en: translated.en.name ?? cat.nameTr, ar: translated.ar.name ?? cat.nameTr },
		tagline: { tr: meta.tagline, en: translated.en.tagline ?? meta.tagline, ar: translated.ar.tagline ?? meta.tagline },
		description: { tr: meta.description, en: translated.en.description ?? meta.description, ar: translated.ar.description ?? meta.description },
		cover: url,
		sortOrder: cat.sortOrder
	});
	console.log(`   ✓ inserted ${cat.slug}`);
}

async function processItem(item) {
	console.log(`\n🍽  Item: ${item.nameTr} (${item.slug})`);

	const descTr = await genItemDescription(item.nameTr, item.info);
	console.log(`   description: ${descTr}`);

	const translated = await translate({ name: item.nameTr, description: descTr });

	console.log(`   ⌛ generating image…`);
	const buffer = await genImage(itemPrompt(item));
	const url = await uploadBuffer(buffer, 'items', item.slug);
	console.log(`   ✓ ${url}`);

	const priceLabel = item.priceLabels?.[0] ?? null;
	const priceAlt = item.priceAlt;
	const priceAltLabel = item.priceLabels?.[1] ?? null;
	const safeLabels = priceAlt && priceLabel && priceAltLabel ? { priceLabel, priceAltLabel } : { priceLabel: null, priceAltLabel: null };

	const hasPrice = item.price != null && item.price > 0;
	await insertItem({
		slug: item.slug,
		categorySlug: item.categorySlug,
		name: { tr: item.nameTr, en: translated.en.name ?? item.nameTr, ar: translated.ar.name ?? item.nameTr },
		description: { tr: descTr, en: translated.en.description ?? descTr, ar: translated.ar.description ?? descTr },
		price: item.price ?? 0,
		priceLabel: priceAlt ? safeLabels.priceLabel : null,
		priceAlt: priceAlt ?? null,
		priceAltLabel: priceAlt ? safeLabels.priceAltLabel : null,
		image: url,
		sortOrder: item.sortOrder,
		isPublished: hasPrice
	});
	console.log(`   ✓ inserted ${item.slug}${hasPrice ? '' : ' (DRAFT — no price)'}`);
}

// ------------------------------------------------------------- concurrency

async function withConcurrency(items, limit, worker) {
	const queue = [...items];
	const errors = [];
	const workers = Array.from({ length: limit }, async () => {
		while (queue.length > 0) {
			const item = queue.shift();
			try {
				await worker(item);
			} catch (err) {
				console.error(`  ✗ ${item.slug}: ${err.message}`);
				errors.push({ item, err });
			}
		}
	});
	await Promise.all(workers);
	return errors;
}

// ------------------------------------------------------------- main

async function main() {
	console.log(`Mode: ${MODE}`);
	console.log(`Excel: ${EXCEL_PATH}\n`);

	const { categories, items } = loadExcel();

	console.log(`Parsed ${categories.length} categories, ${items.length} items.\n`);

	// --- DRY RUN: print plan, no API calls
	if (MODE === 'dry-run') {
		for (const c of categories) {
			console.log(`📁 ${c.nameTr} (${c.slug}) — ${c.items.length} items`);
			for (const it of c.items) {
				const labels = it.priceLabels ? ` [${it.priceLabels.join(' / ')}]` : '';
				const dual = it.priceAlt != null ? ` / ${it.priceAlt}` : '';
				const note = it.info ? `  · ${it.info}` : '';
				console.log(`     ${String(it.sortOrder).padStart(2)}. ${it.nameTr}  ${it.price ?? '?'}${dual} ₺${labels}${note}`);
			}
		}
		console.log('\nDry run complete. No DB writes, no API calls, no charges.');
		console.log('\nNext: node --env-file=.env scripts/bulk-import.mjs --probe');
		return;
	}

	// --- COMMIT: wipe first
	if (MODE === 'commit') {
		console.log('⚠️  --commit will WIPE all categories, items, and storage objects.');
		console.log(`   Then create ${categories.length} categories + ${items.length} items.`);
		console.log(`   Estimated cost: ~$${((categories.length + items.length) * 0.17).toFixed(2)} for images + ~$1 text.`);
		console.log('   Starting in 5 seconds. Ctrl+C to abort.\n');
		await new Promise((r) => setTimeout(r, 5000));
		await wipeEverything();
	}

	// --- Choose which to process
	let catsToProcess = categories;
	let itemsToProcess = items;
	if (MODE === 'probe') {
		// Pick 1 category + first 2 items so we can see a category cover too.
		catsToProcess = [categories[0]];
		itemsToProcess = categories[0].items.slice(0, 2);
		console.log(`Probe: ${catsToProcess[0].nameTr} + ${itemsToProcess.length} items.\n`);
	}

	// --- Categories first (sequential — only 13 of them, gives time for early failure)
	for (const c of catsToProcess) {
		try {
			await processCategory(c);
		} catch (err) {
			console.error(`✗ Category ${c.slug} failed: ${err.message}`);
			if (MODE === 'probe') return;
		}
	}

	// --- Items in parallel
	const errors = await withConcurrency(itemsToProcess, IMAGE_CONCURRENCY, processItem);

	console.log(`\n${'='.repeat(60)}`);
	console.log(`✓ ${itemsToProcess.length - errors.length} items inserted, ${errors.length} failed.`);
	if (errors.length > 0) {
		console.log('\nFailed items:');
		for (const { item, err } of errors) {
			console.log(`  - ${item.slug}: ${err.message}`);
		}
	}
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
