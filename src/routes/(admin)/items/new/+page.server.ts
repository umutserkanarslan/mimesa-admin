import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { DbCategory, Translated } from '$lib/server/db.types';
import { uploadImage } from '$lib/storage';
import { slugify } from '$lib/slug';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { data: categories } = await locals.supabaseAdmin
		.from('categories')
		.select('*')
		.order('sort_order');
	return {
		categories: (categories ?? []) as DbCategory[],
		preselectedCategory: url.searchParams.get('category') ?? ''
	};
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
		const description = tr(form, 'description');
		const slugInput = String(form.get('slug') ?? '').trim();
		const slug = slugInput || slugify(name.tr);
		const categorySlug = String(form.get('category_slug') ?? '').trim();
		const price = Number(form.get('price') ?? 0);
		const flags = String(form.get('flags') ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		const sortOrder = Number(form.get('sort_order') ?? 0);
		const isPublished = form.get('is_published') === 'on';

		const fields = { ...Object.fromEntries(form), slug };

		if (!slug) return fail(400, { ...fields, error: 'Slug boş olamaz.' });
		if (!categorySlug) return fail(400, { ...fields, error: 'Kategori seç.' });
		if (!Number.isFinite(price) || price <= 0) return fail(400, { ...fields, error: 'Geçerli bir fiyat gir.' });
		for (const v of [name, description]) {
			if (!v.tr || !v.en || !v.ar) {
				return fail(400, { ...fields, error: 'Tüm dillerde doldurulması gereken alanlar var.' });
			}
		}

		// Check slug uniqueness
		const { data: existing } = await locals.supabaseAdmin
			.from('items')
			.select('slug')
			.eq('slug', slug)
			.maybeSingle();
		if (existing) return fail(400, { ...fields, error: `"${slug}" slug zaten kullanılıyor.` });

		let image: string | null = null;
		const file = form.get('image');
		if (file instanceof File && file.size > 0) {
			try {
				image = await uploadImage(file, 'items', slug);
			} catch (e) {
				return fail(400, { ...fields, error: e instanceof Error ? e.message : 'Yükleme başarısız.' });
			}
		}

		const { error } = await locals.supabaseAdmin.from('items').insert({
			slug,
			category_slug: categorySlug,
			name,
			description,
			price,
			currency: 'TRY',
			image,
			flags,
			sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
			is_published: isPublished
		});
		if (error) return fail(500, { ...fields, error: error.message });

		throw redirect(303, `/items/${slug}`);
	}
};
