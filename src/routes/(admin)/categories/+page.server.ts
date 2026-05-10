import type { PageServerLoad } from './$types';
import type { DbCategory } from '$lib/server/db.types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data: categories, error } = await locals.supabaseAdmin
		.from('categories')
		.select('*')
		.order('sort_order', { ascending: true });

	if (error) {
		throw new Error(error.message);
	}

	const { data: items } = await locals.supabaseAdmin
		.from('items')
		.select('category_slug, is_published');

	const counts: Record<string, { total: number; published: number }> = {};
	for (const it of items ?? []) {
		const k = it.category_slug;
		counts[k] = counts[k] ?? { total: 0, published: 0 };
		counts[k].total++;
		if (it.is_published) counts[k].published++;
	}

	return {
		categories: (categories ?? []) as DbCategory[],
		counts
	};
};
