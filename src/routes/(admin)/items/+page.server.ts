import type { PageServerLoad } from './$types';
import type { DbCategory, DbItem } from '$lib/server/db.types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const filter = url.searchParams.get('category') ?? '';
	const search = url.searchParams.get('q')?.toLowerCase() ?? '';

	const [{ data: categories }, { data: items }] = await Promise.all([
		locals.supabaseAdmin.from('categories').select('*').order('sort_order'),
		locals.supabaseAdmin
			.from('items')
			.select('*')
			.order('category_slug')
			.order('sort_order')
			.order('created_at')
	]);

	let list = (items ?? []) as DbItem[];
	if (filter) list = list.filter((i) => i.category_slug === filter);
	if (search) {
		list = list.filter((i) => {
			const haystack = `${i.slug} ${i.name.tr} ${i.name.en} ${i.name.ar}`.toLowerCase();
			return haystack.includes(search);
		});
	}

	return {
		categories: (categories ?? []) as DbCategory[],
		items: list,
		filter,
		search
	};
};
