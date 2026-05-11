<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import { slugify } from '$lib/slug';
	import TranslateButton from '$lib/components/TranslateButton.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const f = $derived((form ?? {}) as Record<string, string | undefined> & { error?: string });

	let nameTr = $state('');
	let nameEn = $state('');
	let nameAr = $state('');
	let descriptionTr = $state('');
	let descriptionEn = $state('');
	let descriptionAr = $state('');
	let slug = $state('');
	let slugTouched = $state(false);

	let saving = $state(false);

	const flagOptions = ['signature', 'vegan', 'vegetarian', 'spicy', 'gluten-free'];
	let selectedFlags = $state<string[]>([]);

	// Re-hydrate from server-returned form fields after a failed submit
	$effect(() => {
		const ff = f;
		untrack(() => {
			if (ff.name_tr) nameTr = ff.name_tr;
			if (ff.name_en) nameEn = ff.name_en;
			if (ff.name_ar) nameAr = ff.name_ar;
			if (ff.description_tr) descriptionTr = ff.description_tr;
			if (ff.description_en) descriptionEn = ff.description_en;
			if (ff.description_ar) descriptionAr = ff.description_ar;
			if (ff.slug) {
				slug = ff.slug;
				slugTouched = true;
			}
			if (ff.flags) {
				selectedFlags = ff.flags.split(',').map((s) => s.trim()).filter(Boolean);
			}
		});
	});

	$effect(() => {
		if (!slugTouched) slug = slugify(nameTr);
	});

	function toggleFlag(flag: string) {
		selectedFlags = selectedFlags.includes(flag)
			? selectedFlags.filter((x) => x !== flag)
			: [...selectedFlags, flag];
	}
</script>

<svelte:head>
	<title>Yeni ürün · Mi Mesa Admin</title>
</svelte:head>

<header class="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
	<a href="/items" class="text-xs text-[var(--color-muted)] hover:text-[var(--color-copper)]">← Ürünler</a>
	<p class="eyebrow mt-3">Yeni ürün</p>
	<h1 class="mt-1 text-2xl sm:text-3xl">Tabağı sofraya ekle</h1>
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
	class="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-4xl space-y-6 sm:space-y-8"
>
	<input type="hidden" name="flags" value={selectedFlags.join(',')} />

	<!-- Basics -->
	<section class="card p-4 sm:p-6">
		<h2 class="text-lg mb-4">Temel</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<div>
				<label class="label" for="category_slug">Kategori *</label>
				<select id="category_slug" name="category_slug" required class="select">
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
				<label class="label" for="slug">Slug *</label>
				<input
					id="slug"
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

	<!-- Translate button -->
	<TranslateButton
		getInput={() => ({ name: nameTr, description: descriptionTr })}
		onResult={(r) => {
			if (r.en.name) nameEn = r.en.name;
			if (r.ar.name) nameAr = r.ar.name;
			if (r.en.description) descriptionEn = r.en.description;
			if (r.ar.description) descriptionAr = r.ar.description;
		}}
		label="TR alanlarını EN ve AR'a çevir"
	/>

	<!-- Name -->
	<section class="card p-4 sm:p-6">
		<h2 class="text-lg mb-4">Ad *</h2>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div>
				<label class="label" for="name_tr">TR</label>
				<input id="name_tr" name="name_tr" bind:value={nameTr} required class="input" />
			</div>
			<div>
				<label class="label" for="name_en">EN</label>
				<input id="name_en" name="name_en" bind:value={nameEn} required class="input" />
			</div>
			<div>
				<label class="label" for="name_ar">AR</label>
				<input id="name_ar" name="name_ar" bind:value={nameAr} required class="input" dir="rtl" />
			</div>
		</div>
	</section>

	<!-- Description -->
	<section class="card p-4 sm:p-6">
		<h2 class="text-lg mb-4">Açıklama *</h2>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div>
				<label class="label" for="description_tr">TR</label>
				<textarea id="description_tr" name="description_tr" rows="4" required class="textarea" bind:value={descriptionTr}></textarea>
			</div>
			<div>
				<label class="label" for="description_en">EN</label>
				<textarea id="description_en" name="description_en" rows="4" required class="textarea" bind:value={descriptionEn}></textarea>
			</div>
			<div>
				<label class="label" for="description_ar">AR</label>
				<textarea id="description_ar" name="description_ar" rows="4" required class="textarea" dir="rtl" bind:value={descriptionAr}></textarea>
			</div>
		</div>
	</section>

	<!-- Price + flags -->
	<section class="card p-4 sm:p-6">
		<h2 class="text-lg mb-4">Fiyat ve etiketler</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
			<div>
				<label class="label" for="price">Fiyat (₺) *</label>
				<input
					id="price"
					type="number"
					name="price"
					value={f.price ?? ''}
					min="0"
					step="1"
					required
					class="input"
				/>
			</div>
			<div>
				<label class="label" for="sort_order">Sıralama</label>
				<input id="sort_order" type="number" name="sort_order" value="0" class="input" />
			</div>
		</div>

		<div class="mt-5">
			<span class="label">Etiketler</span>
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
	<section class="card p-4 sm:p-6">
		<h2 class="text-lg mb-4">Görsel</h2>
		<input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" class="input" />
		<p class="mt-2 text-xs text-[var(--color-muted)]">Önerilen oran 1:1, max 8 MB. Boş bırakılırsa placeholder kullanılır.</p>
	</section>

	<!-- Publish -->
	<section class="card p-4 sm:p-6">
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

	<div class="flex items-center gap-3 flex-wrap">
		<button type="submit" disabled={saving} class="btn btn-primary">
			{saving ? 'Kaydediliyor…' : 'Kaydet'}
		</button>
		<a href="/items" class="btn btn-secondary">İptal</a>
	</div>
</form>
