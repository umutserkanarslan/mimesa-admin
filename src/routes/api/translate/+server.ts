import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { translateFromTurkish, type TranslateInput } from '$lib/server/translate';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) throw error(401, 'Giriş gerekli.');

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Geçersiz JSON.');
	}

	const input = (body as { fields?: TranslateInput })?.fields;
	if (!input || typeof input !== 'object') {
		throw error(400, 'fields alanı eksik.');
	}

	try {
		const result = await translateFromTurkish(input);
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Çeviri hatası.';
		throw error(500, message);
	}
};
