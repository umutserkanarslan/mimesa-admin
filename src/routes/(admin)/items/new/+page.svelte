<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import { slugify } from '$lib/slug';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const f = $derived((form ?? {}) as Record<string, string | undefined> & { error?: string });

	let nameTr = $state(f.name_tr ?? '');
	let slug = $state(f.slug ?? '');
	let slugTouched = $state(Boolean(f.slug));

	let saving = $state(false);

	$effect(() => {
		if (!slugTouched) slug = slugify(nameTr);
	});

	const flagOptions = ['signature', 'vegan', 'vegetarian', 'spicy', 'gluten-free'];
	let selectedFlags = $state<string[]>(
		f.flags ? f.flags.split(',').map((s) => s.trim()).filter(Boolean) : []
	);

	function toggleFlag(f: string) {
		selectedFlags = selectedFlags.includes(f)
			? selectedFlags.filter((x) => x !== f)
			: [...selectedFlags, f];
	}
</script>

<svelte:head>
	<title>Yeni ürün · Mi Mesa Admin</title>
</svelte:head>

<header class="px-10 py-8 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
	<a href="/items" class="text-xs text-[var(--color-muted)] hover:text-[var(--color-copper)]">← Ürünler</a>
	<p class="eyebrow mt-3">Yeni ürün</p>
	<h1 class="mt-1 text-3xl">Tabağı sofraya ekle</h1>
</header>

<form
	method="POST"
	action="?/create"
	enctype="multipart/form-data"
	use:enhance={() => {
		saving = true;
		return async ({ update }) => {
			await update();
			saving = false;
		};
	}}
	class="px-10 py-8 max-w-4xl space-y-8"
>
	<input type="hidden" name="flags" value={selectedFlags.join(',')} />

	<!-- Basics -->
	<section class="card p-6">
		<h2 class="text-lg mb-4">Temel</h2>
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label class="label">Kategori *</label>
				<select name="category_slug" required class="select">
					<option value="">Seç…</option>
					{#each data.categories as c}
						<option
							value={c.slug}
							selected={(f.category_slug ?? data.preselectedCategory) === c.slug}
						>
							{c.name.tr}
						</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="label">Slug *</label>
				<input
					name="slug"
					value={slug}
					oninput={(e) => {
						slug = (e.target as HTMLInputElement).value;
						slugTouched = true;
					}}
					required
					class="input"
				/>
				<p class="mt-1 text-xs text-[var(--color-muted)]">URL'de görünür. TR adından otomatik oluşur.</p>
			</div>
		</div>
	</section>

	<!-- Name -->
	<section class="card p-6">
		<h2 class="text-lg mb-4">Ad *</h2>
		<div class="grid grid-cols-3 gap-4">
			<div>
				<label class="label">TR</label>
				<input
					name="name_tr"
					value={nameTr}
					oninput={(e) => (nameTr = (e.target as HTMLInputElement).value)}
					required
					class="input"
				/>
			</div>
			<div>
				<label class="label">EN</label>
				<input name="name_en" value={(f.name_en as string) ?? ''} required class="input" />
			</div>
			<div>
				<label class="label">AR</label>
				<input name="name_ar" value={(f.name_ar as string) ?? ''} required class="input" dir="rtl" />
			</div>
		</div>
	</section>

	<!-- Description -->
	<section class="card p-6">
		<h2 class="text-lg mb-4">Açıklama *</h2>
		<div class="grid grid-cols-3 gap-4">
			<div>
				<label class="label">TR</label>
				<textarea name="description_tr" rows="4" required class="textarea"
					>{(f.description_tr as string) ?? ''}</textarea
				>
			</div>
			<div>
				<label class="label">EN</label>
				<textarea name="description_en" rows="4" required class="textarea"
					>{(f.description_en as string) ?? ''}</textarea
				>
			</div>
			<div>
				<label class="label">AR</label>
				<textarea name="description_ar" rows="4" required class="textarea" dir="rtl"
					>{(f.description_ar as string) ?? ''}</textarea
				>
			</div>
		</div>
	</section>

	<!-- Price + flags -->
	<section class="card p-6">
		<h2 class="text-lg mb-4">Fiyat ve etiketler</h2>
		<div class="grid grid-cols-2 gap-6">
			<div>
				<label class="label">Fiyat (₺) *</label>
				<input
					type="number"
					name="price"
					value={(f.price as string) ?? ''}
					min="0"
					step="1"
					required
					class="input"
				/>
			</div>
			<div>
				<label class="label">Sıralama</label>
				<input type="number" name="sort_order" value="0" class="input" />
			</div>
		</div>

		<div class="mt-5">
			<label class="label">Etiketler</label>
			<div class="flex flex-wrap gap-2">
				{#each flagOptions as flag}
					{@const active = selectedFlags.includes(flag)}
					<button
						type="button"
						onclick={() => toggleFlag(flag)}
						class="badge {active ? 'badge-copper' : ''} cursor-pointer hover:border-[var(--color-copper)]"
					>
						{flag}
					</button>
				{/each}
			</div>
		</div>
	</section>

	<!-- Image -->
	<section class="card p-6">
		<h2 class="text-lg mb-4">Görsel</h2>
		<input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" class="input" />
		<p class="mt-2 text-xs text-[var(--color-muted)]">Önerilen oran 1:1, max 8 MB. Boş bırakılırsa placeholder kullanılır.</p>
	</section>

	<!-- Publish -->
	<section class="card p-6">
		<label class="flex items-center gap-3">
			<input type="checkbox" name="is_published" checked />
			<span>
				<span class="block text-sm">Yayında</span>
				<span class="block text-xs text-[var(--color-muted)]">Kapalıysa menüde görünmez.</span>
			</span>
		</label>
	</section>

	{#if form?.error}
		<div class="card p-4 border-l-2 border-[var(--color-danger)]">
			<p class="text-sm text-[var(--color-danger)]">{form.error}</p>
		</div>
	{/if}

	<div class="flex items-center gap-3">
		<button type="submit" disabled={saving} class="btn btn-primary">
			{saving ? 'Kaydediliyor…' : 'Kaydet'}
		</button>
		<a href="/items" class="btn btn-secondary">İptal</a>
	</div>
</form>
