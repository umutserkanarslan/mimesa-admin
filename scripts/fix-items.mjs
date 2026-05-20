// Mi Mesa — targeted fix for 5 mis-generated menu items.
//
// The bulk import gave these items wrong imagery / descriptions:
//   - sprite / sprite-1-lt / sprite-2-5-lt : images looked like ayran
//     (white, cloudy) instead of a clear lemon-lime soda.
//   - semsemok : image looked like yaprak sarma; description fabricated a
//     "crispy fried shell". Şemşemok is a boiled half-moon dumpling.
//   - kuru-dolma : image looked like yaprak sarma; it is stuffed sun-dried
//     peppers AND eggplants.
//
// This script regenerates the image (gpt-image-1, high quality) and, where
// noted, patches the description / name straight in the DB. Storage path is
// reused (upsert) so no orphan objects are left behind.
//
// Usage:
//   node --env-file=.env scripts/fix-items.mjs

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Buffer } from 'node:buffer';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_KEY) {
	console.error('Missing env: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
	process.exit(1);
}

const STORAGE_BUCKET = 'menu-images';
const IMAGE_QUALITY = 'high'; // only 5 images — worth the extra fidelity

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false }
});
const openai = new OpenAI({ apiKey: OPENAI_KEY, maxRetries: 8 });

// ------------------------------------------------------------- the fixes

const FIXES = [
	{
		slug: 'sprite',
		prompt:
			'A tall clear highball glass of Sprite — a completely colourless, crystal-clear, transparent lemon-lime carbonated soda. The glass is filled with bright clear ice cubes, fine sparkling bubbles streaming upward, fresh beads of condensation running down the glass, a thin slice of fresh lime resting on the rim. The drink is glass-clear and fizzy — absolutely NOT milky, NOT white, NOT cloudy, NOT yogurt-like. Set on honed dark stone, soft natural side window light, shallow depth of field, dramatic low-key shadow falloff, surroundings in a muted champagne-colour and ink palette. Editorial fine-dining magazine aesthetic. No alcohol, no text, no labels, no logos.',
		description: null,
		name: null
	},
	{
		slug: 'sprite-1-lt',
		prompt:
			'A chilled clear glass carafe of Sprite — a completely colourless, crystal-clear, transparent lemon-lime carbonated soda — beside a single tall glass poured full with clear ice and rising bubbles. Fresh condensation beads on both vessels, a thin curl of lime peel as garnish. The soda is glass-clear and sparkling — absolutely NOT milky, NOT white, NOT cloudy, NOT yogurt-like. Set on honed dark stone, soft natural side window light, shallow depth of field, dramatic low-key shadow falloff, surroundings in a muted champagne-colour and ink palette. Editorial fine-dining magazine aesthetic. No alcohol, no text, no labels, no logos.',
		description: null,
		name: null
	},
	{
		slug: 'sprite-2-5-lt',
		prompt:
			'A large frosted glass pitcher of Sprite — a completely colourless, crystal-clear, transparent lemon-lime carbonated soda — with two tall glasses poured full of clear ice and fine streaming bubbles, a shareable family-size serving. Fresh condensation beads on the pitcher and glasses, a few thin slices of fresh lime. The soda is glass-clear and fizzy — absolutely NOT milky, NOT white, NOT cloudy, NOT yogurt-like. Set on honed dark stone, soft natural side window light, shallow depth of field, dramatic low-key shadow falloff, surroundings in a muted champagne-colour and ink palette. Editorial fine-dining magazine aesthetic. No alcohol, no text, no labels, no logos.',
		description: null,
		name: null
	},
	{
		slug: 'semsemok',
		prompt:
			'A hand-thrown dark ceramic bowl of şemşemok, a Southeastern Anatolian dish from Mardin: plump half-moon boiled dough dumplings, each larger than mantı, the pale soft dough fully cooked and tender, filled with rice pilaf and spiced shredded chicken. The dumplings rest under a generous spoonful of thick garlicky strained yogurt, finished with a drizzle of melted butter infused with red pepper flakes (pul biber) pooling warmly at the edges, a light scatter of dried mint on top. Set on dark walnut wood, soft natural side window light, shallow depth of field, low-key dramatic shadow falloff, muted champagne-colour and copper palette. Editorial fine-dining magazine aesthetic. No alcohol, no text, no labels, no logos.',
		description: {
			tr: 'Yarım ay biçiminde kapatılan ince hamur; içinde pirinç ve baharatlı tavuk. Sarımsaklı yoğurt ve pul biberli tereyağıyla, Mardin sofralarından gelen bir emek.',
			en: "Thin dough folded into half-moons, filled with rice and spiced chicken. Crowned with garlicky yogurt and pul biber butter — a labour from Mardin's tables.",
			ar: 'عجين رقيق مطوي على شكل نصف قمر، محشو بالأرز والدجاج المتبّل. يُتوّج بلبن الثوم وزبدة الفلفل الأحمر — جهدٌ من موائد ماردين.'
		},
		name: null
	},
	{
		slug: 'kuru-dolma',
		prompt:
			'A shallow dark ceramic dish of kuru dolma, a Southeastern Anatolian winter dish: whole sun-dried bell peppers and small sun-dried eggplants, their skins wrinkled and deep brick-red and dark mahogany, rehydrated and stuffed full with a spiced rice and bulgur filling flecked with herbs, fully cooked and tender, glistening with olive oil and a faint sheen of pomegranate molasses, arranged snugly side by side. A wedge of lemon to one side. Set on honed dark stone, soft natural side window light, shallow depth of field, low-key dramatic shadow falloff, muted champagne-colour and ink palette. Editorial fine-dining magazine aesthetic. No alcohol, no text, no labels, no logos.',
		description: {
			tr: "Yazın güneşinde kurutulan biber ve patlıcan; baharatlı pirinç ve bulgurla doldurulup kısık ateşin sabrıyla pişer. Güneydoğu'nun kış mirası.",
			en: "Bell peppers and eggplants dried under the summer sun, stuffed with spiced rice and bulgur, then simmered slow and patient. The Southeast's winter heritage.",
			ar: 'فلفل وباذنجان مُجفّفان تحت شمس الصيف، يُحشيان بالأرز المتبّل والبرغل ثم يُطهيان على نار هادئة بصبر. إرث الشتاء في الجنوب الشرقي.'
		},
		name: { tr: 'Kuru Dolma', en: 'Stuffed Sun-Dried Vegetables', ar: 'دولما الخضار المجففة' }
	}
];

// ------------------------------------------------------------- helpers

async function genImage(prompt) {
	const r = await openai.images.generate({
		model: 'gpt-image-1',
		prompt,
		size: '1024x1024',
		quality: IMAGE_QUALITY,
		n: 1
	});
	return Buffer.from(r.data[0].b64_json, 'base64');
}

async function uploadBuffer(buffer, slug) {
	const objectPath = `items/${slug}.png`;
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

// ------------------------------------------------------------- main

async function main() {
	for (const fix of FIXES) {
		console.log(`\n🍽  ${fix.slug}`);
		console.log('   ⌛ generating image…');
		const buffer = await genImage(fix.prompt);
		const url = await uploadBuffer(buffer, fix.slug);
		console.log(`   ✓ image: ${url}`);

		const patch = { image: url };
		if (fix.description) patch.description = fix.description;
		if (fix.name) patch.name = fix.name;

		const { error } = await supabase.from('items').update(patch).eq('slug', fix.slug);
		if (error) throw new Error(`DB update failed for ${fix.slug}: ${error.message}`);
		console.log(`   ✓ DB updated (${Object.keys(patch).join(', ')})`);
	}
	console.log(`\n${'='.repeat(50)}\n✓ All ${FIXES.length} items fixed.`);
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
