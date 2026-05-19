<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import TranslateButton from '$lib/components/TranslateButton.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const item = $derived(data.item);

	let saving = $state(false);
	let deleting = $state(false);

	let nameTr = $state('');
	let nameEn = $state('');
	let nameAr = $state('');
	let descriptionTr = $state('');
	let descriptionEn = $state('');
	let descriptionAr = $state('');

	const flagOptions = ['signature', 'vegan', 'vegetarian', 'spicy', 'gluten-free'];
	let selectedFlags = $state<string[]>([]);

	$effect(() => {
		nameTr = item.name.tr;
		nameEn = item.name.en;
		nameAr = item.name.ar;
		descriptionTr = item.description.tr;
		descriptionEn = item.description.en;
		descriptionAr = item.description.ar;
		selectedFlags = [...item.flags];
	});

	function toggleFlag(f: string) {
		selectedFlags = selectedFlags.includes(f)
			? selectedFlags.filter((x) => x !== f)
			: [...selectedFlags, f];
	}
</script>

<svelte:head>
	<title>{item.name.tr} · Mi Mesa Admin</title>
</svelte:head>

<header class="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
	<a href="/items" class="text-xs text-[var(--color-muted)] hover:text-[var(--color-copper)]">← Ürünler</a>
	<p class="eyebrow mt-3">Ürün · {item.slug}</p>
	<h1 class="mt-1 text-2xl sm:text-3xl break-words">{item.name.tr}</h1>
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
	<input type="hidden" name="flags" value={selectedFlags.join(',')} />

	<!-- Image -->
	<section class="card p-4 sm:p-6">
		<h2 class="text-lg mb-4">Görsel</h2>
		<div class="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
			{#if item.image}
				<img
					src={item.image}
					alt={item.name.tr}
					class="w-28 h-28 sm:w-32 sm:h-32 object-cover bg-[var(--color-champagne-soft)] flex-shrink-0"
				/>
			{:else}
				<div class="w-28 h-28 sm:w-32 sm:h-32 bg-[var(--color-champagne-soft)] flex items-center justify-center text-xs text-[var(--color-muted)] flex-shrink-0">
					Yok
				</div>
			{/if}
			<div class="flex-1 w-full">
				<label class="label" for="image">Yeni görsel (opsiyonel)</label>
				<input id="image" type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" class="input" />
			</div>
		</div>
	</section>

	<!-- Basics -->
	<section class="card p-4 sm:p-6">
		<h2 class="text-lg mb-4">Temel</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<div>
				<label class="label" for="category_slug">Kategori *</label>
				<select id="category_slug" name="category_slug" required class="select">
					{#each data.categories as c}
						<option value={c.slug} selected={item.category_slug === c.slug}>{c.name.tr}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="label" for="slug">Slug</label>
				<input id="slug" value={item.slug} disabled class="input opacity-60" />
				<p class="mt-1 text-xs text-[var(--color-muted)]">Slug değiştirilemez (URL stabilitesi için).</p>
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
				<input id="price" type="number" name="price" value={item.price} min="0" step="1" required class="input" />
			</div>
			<div>
				<label class="label" for="sort_order">Sıralama</label>
				<input id="sort_order" type="number" name="sort_order" value={item.sort_order} class="input" />
			</div>
		</div>

		<div class="mt-5">
			<p class="label !mb-2">İkinci fiyat (opsiyonel)</p>
			<p class="text-xs text-[var(--color-muted)] mb-3">Az/Tam ya da 1 / 1.5 Porsiyon gibi iki seçenekli ürünlerde doldur. Boş bırakırsan menüde tek fiyat gösterilir.</p>
			<div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
				<div>
					<label class="label" for="price_label">1. etiket</label>
					<input id="price_label" name="price_label" value={item.price_label ?? ''} placeholder="Az" class="input" />
				</div>
				<div>
					<label class="label" for="price_alt_label">2. etiket</label>
					<input id="price_alt_label" name="price_alt_label" value={item.price_alt_label ?? ''} placeholder="Tam" class="input" />
				</div>
				<div class="sm:col-span-2">
					<label class="label" for="price_alt">2. fiyat (₺)</label>
					<input id="price_alt" type="number" name="price_alt" value={item.price_alt ?? ''} min="0" step="1" class="input" />
				</div>
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

	<!-- Publish -->
	<section class="card p-4 sm:p-6">
		<label class="flex items-center gap-3">
			<input type="checkbox" name="is_published" checked={item.is_published} />
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

<!-- Delete (separate form) -->
<form
	method="POST"
	action="?/delete"
	use:enhance={({ cancel }) => {
		if (!confirm(`"${item.name.tr}" silinsin mi? Bu işlem geri alınamaz.`)) {
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
		<p class="text-xs text-[var(--color-muted)] mt-1">Ürünü kalıcı olarak siler ve görselini Storage'dan kaldırır.</p>
		<button type="submit" disabled={deleting} class="btn btn-danger mt-4">
			{deleting ? 'Siliniyor…' : 'Ürünü sil'}
		</button>
	</div>
</form>
