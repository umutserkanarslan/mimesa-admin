<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	function formatPrice(p: number) {
		return new Intl.NumberFormat('tr-TR', { style: 'decimal', maximumFractionDigits: 0 }).format(p) + ' ₺';
	}

	function categoryName(slug: string) {
		return data.categories.find((c) => c.slug === slug)?.name.tr ?? slug;
	}
</script>

<svelte:head>
	<title>Ürünler · Mi Mesa Admin</title>
</svelte:head>

<header class="px-10 py-8 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
	<div class="flex items-end justify-between gap-4 flex-wrap">
		<div>
			<p class="eyebrow">Ürünler</p>
			<h1 class="mt-2 text-3xl">Tabaklar</h1>
		</div>
		<a href="/items/new" class="btn btn-primary">+ Yeni ürün</a>
	</div>

	<form method="GET" class="mt-6 flex items-center gap-3 flex-wrap">
		<input
			type="search"
			name="q"
			placeholder="Ara…"
			value={data.search}
			class="input max-w-xs"
		/>
		<select name="category" class="select max-w-xs">
			<option value="">Tüm kategoriler</option>
			{#each data.categories as c}
				<option value={c.slug} selected={data.filter === c.slug}>{c.name.tr}</option>
			{/each}
		</select>
		<button type="submit" class="btn btn-secondary">Filtrele</button>
		{#if data.filter || data.search}
			<a href="/items" class="btn btn-ghost text-sm">Temizle</a>
		{/if}
	</form>
</header>

<div class="px-10 py-8">
	{#if data.items.length === 0}
		<div class="card p-10 text-center text-[var(--color-muted)]">
			<p>Hiç ürün bulunamadı.</p>
			<a href="/items/new" class="btn btn-secondary mt-4 inline-flex">Yeni ürün ekle</a>
		</div>
	{:else}
		<div class="card divide-y divide-[var(--color-border)]">
			{#each data.items as i (i.id)}
				<a
					href="/items/{i.slug}"
					class="flex items-center gap-5 px-5 py-4 hover:bg-[var(--color-canvas)] transition-colors"
				>
					{#if i.image}
						<img
							src={i.image}
							alt={i.name.tr}
							class="w-16 h-16 object-cover bg-[var(--color-champagne-soft)] flex-shrink-0"
							loading="lazy"
						/>
					{:else}
						<div class="w-16 h-16 bg-[var(--color-champagne-soft)] flex items-center justify-center text-xs text-[var(--color-muted)] flex-shrink-0">
							—
						</div>
					{/if}
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<p style="font-family:var(--font-display);font-weight:400;font-size:1.05rem;line-height:1.2;">
								{i.name.tr}
							</p>
							{#if !i.is_published}
								<span class="badge">Taslak</span>
							{/if}
							{#each i.flags as f}
								<span class="badge badge-copper">{f}</span>
							{/each}
						</div>
						<p class="text-xs text-[var(--color-muted)] mt-1 truncate">
							{categoryName(i.category_slug)} · {i.slug}
						</p>
					</div>
					<div class="text-right text-sm flex-shrink-0">
						<p style="font-family:var(--font-display);font-style:italic;color:var(--color-copper);">
							{formatPrice(i.price)}
						</p>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
