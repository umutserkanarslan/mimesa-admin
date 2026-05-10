<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const c = $derived(data.category);
	let saving = $state(false);
</script>

<svelte:head>
	<title>{c.name.tr} · Mi Mesa Admin</title>
</svelte:head>

<header class="px-10 py-8 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
	<a href="/categories" class="text-xs text-[var(--color-muted)] hover:text-[var(--color-copper)]">← Kategoriler</a>
	<p class="eyebrow mt-3">Kategori · {c.slug}</p>
	<h1 class="mt-1 text-3xl">{c.name.tr}</h1>
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
	class="px-10 py-8 max-w-4xl space-y-10"
>
	<!-- Cover -->
	<section class="card p-6">
		<h2 class="text-lg mb-4">Kapak görseli</h2>
		<div class="flex items-start gap-6">
			{#if c.cover}
				<img
					src={c.cover}
					alt="cover"
					class="w-40 h-48 object-cover bg-[var(--color-champagne-soft)] flex-shrink-0"
				/>
			{:else}
				<div
					class="w-40 h-48 bg-[var(--color-champagne-soft)] flex items-center justify-center text-xs text-[var(--color-muted)] flex-shrink-0"
				>
					Görsel yok
				</div>
			{/if}
			<div class="flex-1">
				<label class="label">Yeni görsel yükle (opsiyonel)</label>
				<input type="file" name="cover" accept="image/jpeg,image/png,image/webp,image/avif" class="input" />
				<p class="mt-2 text-xs text-[var(--color-muted)]">
					Önerilen oran 4:5, max 8 MB. Yüklersen mevcut görselin üzerine yazılır.
				</p>
			</div>
		</div>
	</section>

	<!-- Name -->
	<section class="card p-6">
		<h2 class="text-lg mb-4">Ad</h2>
		<div class="grid grid-cols-3 gap-4">
			<div>
				<label class="label">TR</label>
				<input name="name_tr" value={c.name.tr} required class="input" />
			</div>
			<div>
				<label class="label">EN</label>
				<input name="name_en" value={c.name.en} required class="input" />
			</div>
			<div>
				<label class="label">AR</label>
				<input name="name_ar" value={c.name.ar} required class="input" dir="rtl" />
			</div>
		</div>
	</section>

	<!-- Tagline -->
	<section class="card p-6">
		<h2 class="text-lg mb-4">Tagline (italik)</h2>
		<div class="grid grid-cols-3 gap-4">
			<div>
				<label class="label">TR</label>
				<input name="tagline_tr" value={c.tagline.tr} required class="input" />
			</div>
			<div>
				<label class="label">EN</label>
				<input name="tagline_en" value={c.tagline.en} required class="input" />
			</div>
			<div>
				<label class="label">AR</label>
				<input name="tagline_ar" value={c.tagline.ar} required class="input" dir="rtl" />
			</div>
		</div>
	</section>

	<!-- Description -->
	<section class="card p-6">
		<h2 class="text-lg mb-4">Açıklama</h2>
		<div class="grid grid-cols-3 gap-4">
			<div>
				<label class="label">TR</label>
				<textarea name="description_tr" rows="4" required class="textarea">{c.description.tr}</textarea>
			</div>
			<div>
				<label class="label">EN</label>
				<textarea name="description_en" rows="4" required class="textarea">{c.description.en}</textarea>
			</div>
			<div>
				<label class="label">AR</label>
				<textarea name="description_ar" rows="4" required class="textarea" dir="rtl">{c.description.ar}</textarea>
			</div>
		</div>
	</section>

	<!-- Sort order -->
	<section class="card p-6">
		<h2 class="text-lg mb-4">Sıralama</h2>
		<div class="max-w-xs">
			<label class="label">Sort order</label>
			<input type="number" name="sort_order" value={c.sort_order} class="input" />
			<p class="mt-2 text-xs text-[var(--color-muted)]">Düşük sayı önce görünür.</p>
		</div>
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
		<a href="/categories" class="btn btn-secondary">İptal</a>
	</div>
</form>
