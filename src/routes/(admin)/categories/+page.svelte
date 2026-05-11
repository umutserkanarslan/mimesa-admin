<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Kategoriler · Mi Mesa Admin</title>
</svelte:head>

<header class="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
	<div class="flex items-end justify-between gap-4 flex-wrap">
		<div>
			<p class="eyebrow">Kategoriler</p>
			<h1 class="mt-2 text-2xl sm:text-3xl">Menünün omurgası</h1>
			<p class="mt-3 text-sm text-[var(--color-muted)] max-w-xl">
				Kategoriler, ürünleri gruplamak için kullanılır. Tıklayarak adını, açıklamasını ve kapak görselini düzenleyebilirsin.
			</p>
		</div>
		<a href="/categories/new" class="btn btn-primary">+ Yeni kategori</a>
	</div>
</header>

<div class="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-4xl">
	<div class="card divide-y divide-[var(--color-border)]">
		{#each data.categories as c (c.id)}
			{@const cnt = data.counts[c.slug] ?? { total: 0, published: 0 }}
			<a
				href="/categories/{c.slug}"
				class="flex items-stretch gap-3 sm:gap-5 p-3 sm:p-5 hover:bg-[var(--color-canvas)] transition-colors"
			>
				{#if c.cover}
					<img
						src={c.cover}
						alt={c.name.tr}
						class="w-16 h-20 sm:w-20 sm:h-24 object-cover bg-[var(--color-champagne-soft)] flex-shrink-0"
						loading="lazy"
					/>
				{:else}
					<div class="w-16 h-20 sm:w-20 sm:h-24 bg-[var(--color-champagne-soft)] flex items-center justify-center text-xs text-[var(--color-muted)] flex-shrink-0">
						—
					</div>
				{/if}
				<div class="flex-1 min-w-0 flex flex-col justify-center">
					<p class="truncate" style="font-family:var(--font-display);font-weight:400;font-size:1.1rem;line-height:1.2;">
						{c.name.tr}
					</p>
					<p class="text-xs text-[var(--color-muted)] mt-1 truncate">
						{c.name.en} · {c.name.ar}
					</p>
					<p class="text-xs text-[var(--color-copper)] mt-2 italic line-clamp-2" style="font-family:var(--font-display);">
						{c.tagline.tr}
					</p>
				</div>
				<div class="text-right text-xs flex flex-col justify-center flex-shrink-0">
					<p class="text-[var(--color-ink)] whitespace-nowrap">
						{cnt.published}<span class="text-[var(--color-muted)]"> / {cnt.total}</span>
					</p>
					<p class="text-[var(--color-muted)] mt-0.5">ürün</p>
				</div>
			</a>
		{/each}
	</div>
</div>
