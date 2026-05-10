import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { DbCategory, Translated } from '$lib/server/db.types';
import { uploadImage } from '$lib/storage';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { data, error: dbError } = await locals.supabaseAdmin
		.from('categories')
		.select('*')
		.eq('slug', params.slug)
		.maybeSingle();

	if (dbError) throw error(500, dbError.message);
	if (!data) throw error(404, 'Kategori bulunamadı.');

	return { category: data as DbCategory };
};

function tr(form: FormData, prefix: string): Translated {
	return {
		tr: String(form.get(`${prefix}_tr`) ?? '').trim(),
		en: String(form.get(`${prefix}_en`) ?? '').trim(),
		ar: String(form.get(`${prefix}_ar`) ?? '').trim()
	};
}

function validateTr(value: Translated): string | null {
	if (!value.tr || !value.en || !value.ar) {
		return 'Tüm dillerde doldurulması gereken alanlar var.';
	}
	return null;
}

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		const form = await request.formData();

		const name = tr(form, 'name');
		const tagline = tr(form, 'tagline');
		const description = tr(form, 'description');
		const sortOrder = Number(form.get('sort_order') ?? 0);

		for (const v of [name, tagline, description]) {
			const err = validateTr(v);
			if (err) return fail(400, { error: err });
		}

		const update: Record<string, unknown> = {
			name,
			tagline,
			description,
			sort_order: Number.isFinite(sortOrder) ? sortOrder : 0
		};

		// Optional cover upload
		const cover = form.get('cover');
		if (cover instanceof File && cover.size > 0) {
			try {
				update.cover = await uploadImage(cover, 'categories', params.slug);
			} catch (e) {
				return fail(400, { error: e instanceof Error ? e.message : 'Yükleme başarısız.' });
			}
		}

		const { error: dbError } = await locals.supabaseAdmin
			.from('categories')
			.update(update)
			.eq('slug', params.slug);

		if (dbError) return fail(500, { error: dbError.message });

		throw redirect(303, '/categories');
	},

	delete: async ({ params, locals }) => {
		// Refuse if any items reference this category
		const { count, error: countError } = await locals.supabaseAdmin
			.from('items')
			.select('id', { count: 'exact', head: true })
			.eq('category_slug', params.slug);
		if (countError) return fail(500, { error: countError.message });
		if ((count ?? 0) > 0) {
			return fail(400, {
				error: `Bu kategoride ${count} ürün var. Önce ürünleri taşı veya sil.`
			});
		}

		const { error: dbError } = await locals.supabaseAdmin
			.from('categories')
			.delete()
			.eq('slug', params.slug);
		if (dbError) return fail(500, { error: dbError.message });

		throw redirect(303, '/categories');
	}
};
