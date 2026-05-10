<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const item = data.item;

	let saving = $state(false);
	let deleting = $state(false);

	const flagOptions = ['signature', 'vegan', 'vegetarian', 'spicy', 'gluten-free'];
	let selectedFlags = $state<string[]>([...item.flags]);

	function toggleFlag(f: string) {
		selectedFlags = selectedFlags.includes(f)
			? selectedFlags.filter((x) => x !== f)
			: [...selectedFlags, f];
	}
</script>

<svelte:head>
	<title>{item.name.tr} · Mi Mesa Admin</title>
</svelte:head>

<header class="px-10 py-8 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
	<a href="/items" class="text-xs text-[var(--color-muted)] hover:text-[var(--color-copper)]">← Ürünler</a>
	<p class="eyebrow mt-3">Ürün · {item.slug}</p>
	<h1 class="mt-1 text-3xl">{item.name.tr}</h1>
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
	class="px-10 py-8 max-w-4xl space-y-8"
>
	<input type="hidden" name="flags" value={selectedFlags.join(',')} />

	<!-- Image -->
	<section class="card p-6">
		<h2 class="text-lg mb-4">Görsel</h2>
		<div class="flex items-start gap-6">
			{#if item.image}
				<img
					src={item.image}
					alt={item.name.tr}
					class="w-32 h-32 object-cover bg-[var(--color-champagne-soft)] flex-shrink-0"
				/>
			{:else}
				<div class="w-32 h-32 bg-[var(--color-champagne-soft)] flex items-center justify-center text-xs text-[var(--color-muted)] flex-shrink-0">
					Yok
				</div>
			{/if}
			<div class="flex-1">
				<label class="label">Yeni görsel (opsiyonel)</label>
				<input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" class="input" />
			</div>
		</div>
	</section>

	<!-- Basics -->
	<section class="card p-6">
		<h2 class="text-lg mb-4">Temel</h2>
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label class="label">Kategori *</label>
				<select name="category_slug" required class="select">
					{#each data.categories as c}
						<option value={c.slug} selected={item.category_slug === c.slug}>{c.name.tr}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="label">Slug</label>
				<input value={item.slug} disabled class="input opacity-60" />
				<p class="mt-1 text-xs text-[var(--color-muted)]">Slug değiştirilemez (URL stabilitesi için).</p>
			</div>
		</div>
	</section>

	<!-- Name -->
	<section class="card p-6">
		<h2 class="text-lg mb-4">Ad *</h2>
		<div class="grid grid-cols-3 gap-4">
			<div>
				<label class="label">TR</label>
				<input name="name_tr" value={item.name.tr} required class="input" />
			</div>
			<div>
				<label class="label">EN</label>
				<input name="name_en" value={item.name.en} required class="input" />
			</div>
			<div>
				<label class="label">AR</label>
				<input name="name_ar" value={item.name.ar} required class="input" dir="rtl" />
			</div>
		</div>
	</section>

	<!-- Description -->
	<section class="card p-6">
		<h2 class="text-lg mb-4">Açıklama *</h2>
		<div class="grid grid-cols-3 gap-4">
			<div>
				<label class="label">TR</label>
				<textarea name="description_tr" rows="4" required class="textarea">{item.description.tr}</textarea>
			</div>
			<div>
				<label class="label">EN</label>
				<textarea name="description_en" rows="4" required class="textarea">{item.description.en}</textarea>
			</div>
			<div>
				<label class="label">AR</label>
				<textarea name="description_ar" rows="4" required class="textarea" dir="rtl">{item.description.ar}</textarea>
			</div>
		</div>
	</section>

	<!-- Price + flags -->
	<section class="card p-6">
		<h2 class="text-lg mb-4">Fiyat ve etiketler</h2>
		<div class="grid grid-cols-2 gap-6">
			<div>
				<label class="label">Fiyat (₺) *</label>
				<input type="number" name="price" value={item.price} min="0" step="1" required class="input" />
			</div>
			<div>
				<label class="label">Sıralama</label>
				<input type="number" name="sort_order" value={item.sort_order} class="input" />
			</div>
		</div>

		<div class="mt-5">
			<label class="label">Etiketler</label>
			<div class="flex flex-wrap gap-2">
				{#each flagOptions as f}
					{@const active = selectedFlags.includes(f)}
					<button
						type="button"
						onclick={() => toggleFlag(f)}
						class="badge {active ? 'badge-copper' : ''} cursor-pointer hover:border-[var(--color-copper)]"
					>
						{f}
					</button>
				{/each}
			</div>
		</div>
	</section>

	<!-- Publish -->
	<section class="card p-6">
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

	<div class="flex items-center gap-3">
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
	class="px-10 pb-12 max-w-4xl"
>
	<div class="card p-6 border-l-2 border-[var(--color-danger)]">
		<h3 class="text-sm">Tehlikeli bölge</h3>
		<p class="text-xs text-[var(--color-muted)] mt-1">Ürünü kalıcı olarak siler ve görselini Storage'dan kaldırır.</p>
		<button type="submit" disabled={deleting} class="btn btn-danger mt-4">
			{deleting ? 'Siliniyor…' : 'Ürünü sil'}
		</button>
	</div>
</form>
