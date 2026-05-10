import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';

let client: OpenAI | null = null;
function getClient() {
	if (!OPENAI_API_KEY) {
		throw new Error(
			'OPENAI_API_KEY ayarlı değil. Çeviri için bu key zorunlu (Vercel env vars veya .env).'
		);
	}
	if (!client) client = new OpenAI({ apiKey: OPENAI_API_KEY });
	return client;
}

export type TranslateField = 'name' | 'tagline' | 'description';

export interface TranslateInput {
	name?: string;
	tagline?: string;
	description?: string;
}

export interface TranslatedPair {
	name?: string;
	tagline?: string;
	description?: string;
}

export interface TranslateResult {
	en: TranslatedPair;
	ar: TranslatedPair;
}

const SYSTEM_PROMPT = `Sen Mi Mesa adlı, Bodrum'da Anadolu ve Mezopotamya mutfağının modern yorumunu sunan ince yemek (fine dining) restoranın çevirmenisin. Marka sesi şudur:

- Şairane, hissi, editöryel; jenerik menü dilinden uzak
- Türkçe yemek/malzeme adlarını koru: isot, sumak, mantı, künefe, kadayıf, ayran, simit, kısır, çiğ köfte, mezopotamya
- Doğal, akıcı ve kısa cümleler; süslü kelimelerin üstüne çıkma
- Anadolu/Akdeniz mutfağındaki "köy", "tandır", "bakır", "köz", "ateş" gibi duyusal kelimeleri tercüme ederken İngilizce/Arapça'da da dokuyu koru

Sana TR alanları (name, tagline, description'ın bir alt kümesi) JSON olarak verilecek. Her birini İngilizce (en) ve Arapça (ar) olarak çevir. Sadece sana verilen anahtarları döndür — boş alanlar olursa onları döndürme. Çıktı şu yapıda strict JSON olmalı:

{
  "en": { ... },
  "ar": { ... }
}

Hiçbir açıklama, sadece JSON.`;

export async function translateFromTurkish(input: TranslateInput): Promise<TranslateResult> {
	// Strip empty fields
	const cleaned: TranslateInput = {};
	for (const [k, v] of Object.entries(input)) {
		if (typeof v === 'string' && v.trim()) cleaned[k as TranslateField] = v.trim();
	}
	if (Object.keys(cleaned).length === 0) {
		return { en: {}, ar: {} };
	}

	const completion = await getClient().chat.completions.create({
		model: 'gpt-4o-mini',
		response_format: { type: 'json_object' },
		temperature: 0.4,
		messages: [
			{ role: 'system', content: SYSTEM_PROMPT },
			{ role: 'user', content: JSON.stringify(cleaned) }
		]
	});

	const raw = completion.choices[0]?.message?.content ?? '{}';
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error('OpenAI cevabı JSON olarak ayrıştırılamadı.');
	}
	if (!parsed || typeof parsed !== 'object') {
		throw new Error('OpenAI cevabı geçersiz şekilde geldi.');
	}
	const obj = parsed as { en?: TranslatedPair; ar?: TranslatedPair };
	return { en: obj.en ?? {}, ar: obj.ar ?? {} };
}
