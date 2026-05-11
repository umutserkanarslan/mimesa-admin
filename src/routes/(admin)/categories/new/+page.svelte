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
	let taglineTr = $state('');
	let taglineEn = $state('');
	let taglineAr = $state('');
	let descriptionTr = $state('');
	let descriptionEn = $state('');
	let descriptionAr = $state('');
	let slug = $state('');
	let slugTouched = $state(false);

	let saving = $state(false);

	$effect(() => {
		const ff = f;
		untrack(() => {
			if (ff.name_tr) nameTr = ff.name_tr;
			if (ff.name_en) nameEn = ff.name_en;
			if (ff.name_ar) nameAr = ff.name_ar;
			if (ff.tagline_tr) taglineTr = ff.tagline_tr;
			if (ff.tagline_en) taglineEn = ff.tagline_en;
			if (ff.tagline_ar) taglineAr = ff.tagline_ar;
			if (ff.description_tr) descriptionTr = ff.description_tr;
			if (ff.description_en) descriptionEn = ff.description_en;
			if (ff.description_ar) descriptionAr = ff.description_ar;
			if (ff.slug) {
				slug = ff.slug;
				slugTouched = true;
			}
		});
	});

	$effect(() => {
		if (!slugTouched) slug = slugify(nameTr);
	});
</script>

<svelte:head>
	<title>Yeni kategori · Mi Mesa Admin</title>
</svelte:head>

<header class="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
	<a href="/categories" class="text-xs text-[var(--color-muted)] hover:text-[var(--color-copper)]">← Kategoriler</a>
	<p class="eyebrow mt-3">Yeni kategori</p>
	<h1 class="mt-1 text-2xl sm:text-3xl">Menüye yeni bir başlık aç</h1>
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
	<!-- Cover -->
	<section class="card p-4 sm:p-6">
		<h2 class="text-lg mb-4">Kapak görseli</h2>
		<input type="file" name="cover" accept="image/jpeg,image/png,image/webp,image/avif" class="input" />
		<p class="mt-2 text-xs text-[var(--color-muted)]">Önerilen oran 4:5, max 8 MB. Boş bırakılırsa placeholder kullanılır.</p>
	</section>

	<!-- Slug + sort -->
	<section class="card p-4 sm:p-6">
		<h2 class="text-lg mb-4">Temel</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
			<div>
				<label class="label" for="sort_order">Sıralama</label>
				<input id="sort_order" type="number" name="sort_order" value={data.nextSort} class="input" />
				<p class="mt-1 text-xs text-[var(--color-muted)]">Düşük sayı önce görünür.</p>
			</div>
		</div>
	</section>

	<!-- Translate -->
	<TranslateButton
		getInput={() => ({ name: nameTr, tagline: taglineTr, description: descriptionTr })}
		onResult={(r) => {
			if (r.en.name) nameEn = r.en.name;
			if (r.ar.name) nameAr = r.ar.name;
			if (r.en.tagline) taglineEn = r.en.tagline;
			if (r.ar.tagline) taglineAr = r.ar.tagline;
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

	<!-- Tagline -->
	<section class="card p-4 sm:p-6">
		<h2 class="text-lg mb-4">Tagline (italik) *</h2>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div>
				<label class="label" for="tagline_tr">TR</label>
				<input id="tagline_tr" name="tagline_tr" bind:value={taglineTr} required class="input" />
			</div>
			<div>
				<label class="label" for="tagline_en">EN</label>
				<input id="tagline_en" name="tagline_en" bind:value={taglineEn} required class="input" />
			</div>
			<div>
				<label class="label" for="tagline_ar">AR</label>
				<input id="tagline_ar" name="tagline_ar" bind:value={taglineAr} required class="input" dir="rtl" />
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

	{#if form?.error}
		<div class="card p-4 border-l-2 border-[var(--color-danger)]">
			<p class="text-sm text-[var(--color-danger)]">{form.error}</p>
		</div>
	{/if}

	<div class="flex items-center gap-3 flex-wrap">
		<button type="submit" disabled={saving} class="btn btn-primary">
			{saving ? 'Kaydediliyor…' : 'Kategori oluştur'}
		</button>
		<a href="/categories" class="btn btn-secondary">İptal</a>
	</div>
</form>
