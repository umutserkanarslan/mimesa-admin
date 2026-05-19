export type Translated = { tr: string; en: string; ar: string };

export interface DbCategory {
	id: string;
	slug: string;
	name: Translated;
	tagline: Translated;
	description: Translated;
	cover: string | null;
	sort_order: number;
	created_at: string;
	updated_at: string;
}

export interface DbItem {
	id: string;
	slug: string;
	category_slug: string;
	name: Translated;
	description: Translated;
	price: number;
	price_label: string | null;
	price_alt: number | null;
	price_alt_label: string | null;
	currency: string;
	image: string | null;
	flags: string[];
	sort_order: number;
	is_published: boolean;
	created_at: string;
	updated_at: string;
}

export type CategoryInsert = Omit<DbCategory, 'id' | 'created_at' | 'updated_at'> & {
	id?: string;
};
export type ItemInsert = Omit<DbItem, 'id' | 'created_at' | 'updated_at'> & {
	id?: string;
};

export interface Database {
	public: {
		Tables: {
			categories: {
				Row: DbCategory;
				Insert: CategoryInsert;
				Update: Partial<DbCategory>;
			};
			items: {
				Row: DbItem;
				Insert: ItemInsert;
				Update: Partial<DbItem>;
			};
		};
	};
}
