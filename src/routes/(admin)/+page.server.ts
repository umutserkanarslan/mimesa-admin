import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [{ data: categories }, { data: items }] = await Promise.all([
		locals.supabaseAdmin
			.from('categories')
			.select('id, slug, name, sort_order')
			.order('sort_order', { ascending: true }),
		locals.supabaseAdmin
			.from('items')
			.select('id, slug, category_slug, is_published')
	]);

	const cats = categories ?? [];
	const itms = items ?? [];

	const counts = cats.map((c) => ({
		slug: c.slug,
		name: c.name,
		total: itms.filter((i) => i.category_slug === c.slug).length,
		published: itms.filter((i) => i.category_slug === c.slug && i.is_published).length
	}));

	return {
		stats: {
			categories: cats.length,
			items: itms.length,
			published: itms.filter((i) => i.is_published).length
		},
		counts
	};
};
