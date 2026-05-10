import { supabaseAdmin, STORAGE_BUCKET } from './server/supabase-admin';

export type UploadKind = 'categories' | 'items';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function uploadImage(file: File, kind: UploadKind, slug: string): Promise<string> {
	if (!ALLOWED_MIME.includes(file.type)) {
		throw new Error(`Geçersiz dosya tipi: ${file.type}. JPG, PNG, WebP veya AVIF olmalı.`);
	}
	if (file.size > MAX_BYTES) {
		throw new Error('Görsel 8 MB\'dan büyük olamaz.');
	}

	const ext = file.type === 'image/png'
		? 'png'
		: file.type === 'image/webp'
			? 'webp'
			: file.type === 'image/avif'
				? 'avif'
				: 'jpg';

	const path = `${kind}/${slug}.${ext}`;
	const buffer = new Uint8Array(await file.arrayBuffer());

	const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(path, buffer, {
		contentType: file.type,
		upsert: true,
		cacheControl: '31536000'
	});
	if (error) {
		throw new Error(`Yükleme hatası: ${error.message}`);
	}

	const { data } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
	// Append a cache-busting query so existing CDN caches refresh
	return `${data.publicUrl}?v=${Date.now()}`;
}

export async function deleteByUrl(url: string | null) {
	if (!url) return;
	// Extract path after /menu-images/
	const match = url.match(/\/menu-images\/(.+?)(?:\?|$)/);
	if (!match) return;
	await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([match[1]]);
}
