<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Kategoriler · Mi Mesa Admin</title>
</svelte:head>

<header class="px-10 py-8 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
	<p class="eyebrow">Kategoriler</p>
	<h1 class="mt-2 text-3xl">Menünün omurgası</h1>
	<p class="mt-3 text-sm text-[var(--color-muted)] max-w-xl">
		Kategoriler, ürünleri gruplamak için kullanılır. Bir kategoriye tıklayarak adını, açıklamasını ve kapak görselini düzenleyebilirsin.
	</p>
</header>

<div class="px-10 py-8 max-w-4xl">
	<div class="card divide-y divide-[var(--color-border)]">
		{#each data.categories as c (c.id)}
			{@const cnt = data.counts[c.slug] ?? { total: 0, published: 0 }}
			<a
				href="/categories/{c.slug}"
				class="flex items-stretch gap-5 p-5 hover:bg-[var(--color-canvas)] transition-colors"
			>
				{#if c.cover}
					<img
						src={c.cover}
						alt={c.name.tr}
						class="w-20 h-24 object-cover bg-[var(--color-champagne-soft)] flex-shrink-0"
						loading="lazy"
					/>
				{:else}
					<div class="w-20 h-24 bg-[var(--color-champagne-soft)] flex items-center justify-center text-xs text-[var(--color-muted)]">
						—
					</div>
				{/if}
				<div class="flex-1 min-w-0 flex flex-col justify-center">
					<p style="font-family:var(--font-display);font-weight:400;font-size:1.25rem;line-height:1.2;">
						{c.name.tr}
					</p>
					<p class="text-xs text-[var(--color-muted)] mt-1">
						{c.name.en} · {c.name.ar}
					</p>
					<p class="text-xs text-[var(--color-copper)] mt-2 italic" style="font-family:var(--font-display);">
						{c.tagline.tr}
					</p>
				</div>
				<div class="text-right text-xs flex flex-col justify-center">
					<p class="text-[var(--color-ink)]">
						{cnt.published}<span class="text-[var(--color-muted)]"> / {cnt.total}</span>
					</p>
					<p class="text-[var(--color-muted)] mt-0.5">ürün</p>
				</div>
			</a>
		{/each}
	</div>
</div>
