<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import TranslateButton from '$lib/components/TranslateButton.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const c = $derived(data.category);
	let saving = $state(false);
	let deleting = $state(false);

	let nameTr = $state('');
	let nameEn = $state('');
	let nameAr = $state('');
	let taglineTr = $state('');
	let taglineEn = $state('');
	let taglineAr = $state('');
	let descriptionTr = $state('');
	let descriptionEn = $state('');
	let descriptionAr = $state('');

	$effect(() => {
		nameTr = c.name.tr;
		nameEn = c.name.en;
		nameAr = c.name.ar;
		taglineTr = c.tagline.tr;
		taglineEn = c.tagline.en;
		taglineAr = c.tagline.ar;
		descriptionTr = c.description.tr;
		descriptionEn = c.description.en;
		descriptionAr = c.description.ar;
	});
</script>

<svelte:head>
	<title>{c.name.tr} · Mi Mesa Admin</title>
</svelte:head>

<header class="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
	<a href="/categories" class="text-xs text-[var(--color-muted)] hover:text-[var(--color-copper)]">← Kategoriler</a>
	<p class="eyebrow mt-3">Kategori · {c.slug}</p>
	<h1 class="mt-1 text-2xl sm:text-3xl break-words">{c.name.tr}</h1>
</header>

<form
	method="POST"
	action="?/save"
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
		<div class="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
			{#if c.cover}
				<img
					src={c.cover}
					alt="cover"
					class="w-32 h-40 sm:w-40 sm:h-48 object-cover bg-[var(--color-champagne-soft)] flex-shrink-0"
				/>
			{:else}
				<div
					class="w-32 h-40 sm:w-40 sm:h-48 bg-[var(--color-champagne-soft)] flex items-center justify-center text-xs text-[var(--color-muted)] flex-shrink-0"
				>
					Görsel yok
				</div>
			{/if}
			<div class="flex-1 w-full">
				<label class="label" for="cover">Yeni görsel yükle (opsiyonel)</label>
				<input id="cover" type="file" name="cover" accept="image/jpeg,image/png,image/webp,image/avif" class="input" />
				<p class="mt-2 text-xs text-[var(--color-muted)]">
					Önerilen oran 4:5, max 8 MB. Yüklersen mevcut görselin üzerine yazılır.
				</p>
			</div>
		</div>
	</section>

	<!-- Translate button -->
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
		<h2 class="text-lg mb-4">Ad</h2>
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
		<h2 class="text-lg mb-4">Tagline (italik)</h2>
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
		<h2 class="text-lg mb-4">Açıklama</h2>
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

	<!-- Sort order -->
	<section class="card p-4 sm:p-6">
		<h2 class="text-lg mb-4">Sıralama</h2>
		<div class="max-w-xs">
			<label class="label" for="sort_order">Sort order</label>
			<input id="sort_order" type="number" name="sort_order" value={c.sort_order} class="input" />
			<p class="mt-2 text-xs text-[var(--color-muted)]">Düşük sayı önce görünür.</p>
		</div>
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
		<a href="/categories" class="btn btn-secondary">İptal</a>
	</div>
</form>

<!-- Delete (separate form) -->
<form
	method="POST"
	action="?/delete"
	use:enhance={({ cancel }) => {
		if (!confirm(`"${c.name.tr}" kategorisi silinsin mi? İçinde ürün varsa engellenir.`)) {
			cancel();
			return;
		}
		deleting = true;
		return async ({ update }) => {
			await update();
			deleting = false;
		};
	}}
	class="px-4 sm:px-6 lg:px-10 pb-10 lg:pb-12 max-w-4xl"
>
	<div class="card p-4 sm:p-6 border-l-2 border-[var(--color-danger)]">
		<h3 class="text-sm">Tehlikeli bölge</h3>
		<p class="text-xs text-[var(--color-muted)] mt-1">Boş bir kategoriyi kalıcı olarak siler. İçinde ürün varsa silinemez.</p>
		<button type="submit" disabled={deleting} class="btn btn-danger mt-4">
			{deleting ? 'Siliniyor…' : 'Kategoriyi sil'}
		</button>
	</div>
</form>
