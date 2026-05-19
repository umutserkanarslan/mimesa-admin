import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { DbCategory, DbItem, Translated } from '$lib/server/db.types';
import { deleteByUrl, uploadImage } from '$lib/storage';

export const load: PageServerLoad = async ({ params, locals }) => {
	const [{ data: item, error: itemError }, { data: categories }] = await Promise.all([
		locals.supabaseAdmin.from('items').select('*').eq('slug', params.slug).maybeSingle(),
		locals.supabaseAdmin.from('categories').select('*').order('sort_order')
	]);

	if (itemError) throw error(500, itemError.message);
	if (!item) throw error(404, 'Ürün bulunamadı.');

	return {
		item: item as DbItem,
		categories: (categories ?? []) as DbCategory[]
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
	save: async ({ request, params, locals }) => {
		const form = await request.formData();

		const name = tr(form, 'name');
		const description = tr(form, 'description');
		const categorySlug = String(form.get('category_slug') ?? '').trim();
		const price = Number(form.get('price') ?? 0);
		const priceLabelRaw = String(form.get('price_label') ?? '').trim();
		const priceAltRaw = String(form.get('price_alt') ?? '').trim();
		const priceAltLabelRaw = String(form.get('price_alt_label') ?? '').trim();
		const flags = String(form.get('flags') ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		const sortOrder = Number(form.get('sort_order') ?? 0);
		const isPublished = form.get('is_published') === 'on';

		if (!categorySlug) return fail(400, { error: 'Kategori seç.' });
		if (!Number.isFinite(price) || price <= 0) return fail(400, { error: 'Geçerli bir fiyat gir.' });
		for (const v of [name, description]) {
			if (!v.tr || !v.en || !v.ar) {
				return fail(400, { error: 'Tüm dillerde doldurulması gereken alanlar var.' });
			}
		}

		let priceAlt: number | null = null;
		let priceLabel: string | null = null;
		let priceAltLabel: string | null = null;
		if (priceAltRaw) {
			const n = Number(priceAltRaw);
			if (!Number.isFinite(n) || n <= 0) return fail(400, { error: 'İkinci fiyat geçerli değil.' });
			if (!priceLabelRaw || !priceAltLabelRaw) {
				return fail(400, { error: 'İki fiyat girdiysen her ikisinin de etiketini gir (ör. Az / Tam).' });
			}
			priceAlt = n;
			priceLabel = priceLabelRaw;
			priceAltLabel = priceAltLabelRaw;
		} else if (priceLabelRaw || priceAltLabelRaw) {
			return fail(400, { error: 'Etiket girdiysen ikinci fiyatı da gir.' });
		}

		const update: Record<string, unknown> = {
			category_slug: categorySlug,
			name,
			description,
			price,
			price_label: priceLabel,
			price_alt: priceAlt,
			price_alt_label: priceAltLabel,
			flags,
			sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
			is_published: isPublished
		};

		const file = form.get('image');
		if (file instanceof File && file.size > 0) {
			try {
				update.image = await uploadImage(file, 'items', params.slug);
			} catch (e) {
				return fail(400, { error: e instanceof Error ? e.message : 'Yükleme başarısız.' });
			}
		}

		const { error: dbError } = await locals.supabaseAdmin
			.from('items')
			.update(update)
			.eq('slug', params.slug);
		if (dbError) return fail(500, { error: dbError.message });

		throw redirect(303, '/items');
	},

	delete: async ({ params, locals }) => {
		const { data: item } = await locals.supabaseAdmin
			.from('items')
			.select('image')
			.eq('slug', params.slug)
			.maybeSingle();

		const { error: dbError } = await locals.supabaseAdmin
			.from('items')
			.delete()
			.eq('slug', params.slug);
		if (dbError) return fail(500, { error: dbError.message });

		if (item?.image) {
			await deleteByUrl(item.image);
		}

		throw redirect(303, '/items');
	}
};
