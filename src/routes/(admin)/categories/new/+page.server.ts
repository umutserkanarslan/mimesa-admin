import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Translated } from '$lib/server/db.types';
import { uploadImage } from '$lib/storage';
import { slugify } from '$lib/slug';

export const load: PageServerLoad = async ({ locals }) => {
	const { data: categories } = await locals.supabaseAdmin
		.from('categories')
		.select('sort_order')
		.order('sort_order', { ascending: false })
		.limit(1);
	const nextSort = ((categories?.[0]?.sort_order as number | undefined) ?? 0) + 1;
	return { nextSort };
};

function tr(form: FormData, prefix: string): Translated {
	return {
		tr: String(form.get(`${prefix}_tr`) ?? '').trim(),
		en: String(form.get(`${prefix}_en`) ?? '').trim(),
		ar: String(form.get(`${prefix}_ar`) ?? '').trim()
	};
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const form = await request.formData();

		const name = tr(form, 'name');
		const tagline = tr(form, 'tagline');
		const description = tr(form, 'description');
		const slugInput = String(form.get('slug') ?? '').trim();
		const slug = slugInput || slugify(name.tr);
		const sortOrder = Number(form.get('sort_order') ?? 0);

		const fields = { ...Object.fromEntries(form), slug };

		if (!slug) return fail(400, { ...fields, error: 'Slug boş olamaz.' });
		for (const v of [name, tagline, description]) {
			if (!v.tr || !v.en || !v.ar) {
				return fail(400, { ...fields, error: 'Tüm dillerde doldurulması gereken alanlar var.' });
			}
		}

		// Uniqueness
		const { data: existing } = await locals.supabaseAdmin
			.from('categories')
			.select('slug')
			.eq('slug', slug)
			.maybeSingle();
		if (existing) return fail(400, { ...fields, error: `"${slug}" slug zaten kullanılıyor.` });

		let cover: string | null = null;
		const file = form.get('cover');
		if (file instanceof File && file.size > 0) {
			try {
				cover = await uploadImage(file, 'categories', slug);
			} catch (e) {
				return fail(400, { ...fields, error: e instanceof Error ? e.message : 'Yükleme başarısız.' });
			}
		}

		const { error } = await locals.supabaseAdmin.from('categories').insert({
			slug,
			name,
			tagline,
			description,
			cover,
			sort_order: Number.isFinite(sortOrder) ? sortOrder : 0
		});
		if (error) return fail(500, { ...fields, error: error.message });

		throw redirect(303, `/categories/${slug}`);
	}
};
