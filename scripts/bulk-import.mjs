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

DOĞRULUK KURALI (en önemli):
- Yemeğin gerçek yapım yöntemini ve içeriklerini TAHRİF ETME. Sadece o yemekte gerçekten olan/yapılan şeyleri yaz.
- Paketli/ticari içecekler (Cola, Fanta, Sprite, Icetea, Gazoz, Maden Suyu, Meyve Suyu vb.) ŞAİR DEĞİLDİR. Bu tip ürünlerde "közde pişmiş", "taze bahçeden", "ocaktan", "kömün sabrı" gibi imgeler kullanma. Bunlarda 1 cümle, sade ve nezih bir servis tasviri yeterli ("Buzla servis edilir", "soğuk, ferahlatıcı", "yemek yanına klasik eşlikçi" gibi).
- Ayran, şalgam, çay, salep gibi geleneksel içeceklerde duyusal/hissi dil OK, ama yine yöntem uydurma.
- Yiyeceklerde de aynı: ızgarada pişen şeye "fırında" deme, çiğ köfteye "ocaktan kalkmış" deme, tatlı olmayana "tatlı" deme.

STIL (yiyecekler ve geleneksel içecekler için):
- Hissi ve duyusal kelimeler ("kömün sabrı", "ocaktan", "köz", "taze bahçeden", "günün hasadı") yemeğe gerçekten uyuyorsa kullan
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

// Two-stage image pipeline:
//   1. A "prompt-director" LLM reads the dish/category name and writes
//      ONE bespoke English prompt for that subject, honouring brand rules.
//   2. gpt-image-1 generates the actual image from that prompt.
// Replaces the previous template approach where every category cover ended
// up with the same çay + cezve props.
const IMAGE_PROMPT_SYSTEM = `You are the photography art director for Mi Mesa, a fine-dining Anatolian / Mezopotamia-influenced restaurant in Bodrum, Turkey. Given the name of a single dish OR menu category, write ONE concise English prompt (50–90 words, one paragraph, no line breaks) that an image generation model will use to produce the photo.

HARD RULES — every prompt MUST respect these:
- Editorial fine-dining magazine aesthetic. Think NYT Cooking, Bon Appétit, Eater, Toast Magazine: restrained, moody, hero ingredient over busy props.
- Surface: dark walnut wood OR honed dark stone OR a flour-dusted dark wooden board, depending on the dish.
- Lighting: soft natural window light from the side, shallow depth of field, dramatic shadow falloff, low-key.
- Palette: warm muted champagne (the colour), copper and ink. The food itself can be vivid; the surroundings stay muted.
- STRICTLY NO ALCOHOL. No wine, champagne, beer, cocktails, stemmed wine/champagne glasses, no liquor bottles anywhere in frame.
- No text, no labels, no logos in the image.
- DONENESS: cooked food MUST look fully and properly cooked. Grilled meats (kebap, şiş, köfte) must show real char marks, browned crust, deep cooked colour — NEVER raw-looking, glossy bright red, pink-centred, or undercooked. Eggs should look set; bread should look baked through; cheese melted on pide/pizza should look properly cooked and slightly browned, not pale and gummy.

DIVERSITY RULE — THIS IS THE MOST IMPORTANT RULE:
AVOID repeating the same accent props (tulip çay glass, copper cezve, simit, copper tray) across different prompts. Each image must feel visually distinct from the others. Only place a çay glass or cezve in the frame if it is genuinely intrinsic to THIS specific dish or category — never as default decoration.

ITEM PROMPTS — respect the dish's traditional plating:
- serpme breakfasts → MANY small ceramic and copper bowls spread across the table, not a single composed plate
- künefe → small copper sahan (shallow round pan), pistachio dust
- pide → long boat-shaped flatbread on a wooden board
- lahmacun → thin round flatbread, wedge of lemon, fresh parsley
- dürüm → sliced cross-section on a wooden board with pickles
- çorba → hand-thrown ceramic bowl, steam rising, single accent
- kebap / şiş / köfte → elongated rectangular plate, grilled vegetables, sumac onions
- pilav / bulgur → simple bowl plating, a single herb on top
- salads → hand-thrown bowl with depth, dressing in side cruet
- pizza-style / kiremitte → on a wooden peel or stone surface with flour dust
- non-alcoholic drinks → focused on the glass with light catching condensation; vary the vessel (tumbler, porcelain cup, copper mug for sahlep, tall glass for ayran/şalgam, tulip çay glass ONLY for actual çay)
- For each dish, mention 1–2 hero ingredients that visually define it.

CATEGORY PROMPTS — atmospheric hero, NOT a plated entrée:
A moment, a tool, a single ingredient, or a textural close-up that suggests the chapter's spirit. Examples (do not copy verbatim — invent fresh for each): glowing embers and a single resting skewer for grills; a wood-fired oven mouth with flames for the wood-fire chapter; flour-dusted dark stone with a wooden peel and herbs for pizzas; steam off a single ceramic bowl with shadow for soups; a knife resting on cracked walnut shells and pomegranate seeds for salads; smoke rising from a hot copper skillet just off the flame for the chef's pan; a single torn flatbread on dark stone for wraps; a row of plain tumblers with condensation in soft light for cold drinks. Make every category feel visually unique from the others.

OUTPUT: exactly one paragraph, the prompt only. No quotation marks, no "Prompt:" prefix, no commentary.`;

async function genImagePromptFor(subject, kind, categoryHint) {
	const userMsg = kind === 'category'
		? `Menu CATEGORY: "${subject}"`
		: `Menu ITEM: "${subject}"${categoryHint ? ` (chapter: ${categoryHint})` : ''}`;
	const r = await openai.chat.completions.create({
		model: 'gpt-4o-mini',
		temperature: 0.9,
		messages: [
			{ role: 'system', content: IMAGE_PROMPT_SYSTEM },
			{ role: 'user', content: userMsg }
		]
	});
	return (r.choices[0]?.message?.content ?? '').trim();
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

	console.log(`   ⌛ generating image prompt…`);
	const imgPrompt = await genImagePromptFor(cat.nameTr, 'category');
	console.log(`   prompt: ${imgPrompt}`);
	console.log(`   ⌛ generating cover image…`);
	const buffer = await genImage(imgPrompt);
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

	console.log(`   ⌛ generating image prompt…`);
	const imgPrompt = await genImagePromptFor(item.nameTr, 'item', item.categorySlug);
	console.log(`   prompt: ${imgPrompt}`);
	console.log(`   ⌛ generating image…`);
	const buffer = await genImage(imgPrompt);
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
		// Pick four diverse categories that stress-test the pipeline:
		// breakfast spread, soup, grill, pizza, wrap, drink.
		const probeSlugs = ['kahvaltilar', 'izgaralar', 'pizzalar', 'icecekler'];
		catsToProcess = categories.filter((c) => probeSlugs.includes(c.slug));
		// One item per probed category to see diversity across plating types.
		itemsToProcess = catsToProcess.flatMap((c) => c.items.slice(0, 1));
		console.log(`Probe: ${catsToProcess.length} categories + ${itemsToProcess.length} items.\n`);
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
