<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Genel bakış · Mi Mesa Admin</title>
</svelte:head>

<header class="px-10 py-8 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
	<p class="eyebrow">Genel Bakış</p>
	<h1 class="mt-2 text-3xl">Sofranızın bugünkü durumu</h1>
</header>

<div class="px-10 py-8 max-w-5xl">
	<!-- Stats -->
	<div class="grid grid-cols-3 gap-5 mb-10">
		<div class="card p-6">
			<p class="eyebrow">Kategori</p>
			<p class="mt-3 text-4xl" style="font-family:var(--font-display);font-weight:400;">
				{data.stats.categories}
			</p>
		</div>
		<div class="card p-6">
			<p class="eyebrow">Ürün</p>
			<p class="mt-3 text-4xl" style="font-family:var(--font-display);font-weight:400;">
				{data.stats.items}
			</p>
		</div>
		<div class="card p-6">
			<p class="eyebrow">Yayında</p>
			<p class="mt-3 text-4xl" style="font-family:var(--font-display);font-weight:400;">
				{data.stats.published}
				<span class="text-base text-[var(--color-muted)]">/ {data.stats.items}</span>
			</p>
		</div>
	</div>

	<!-- Categories overview -->
	<section>
		<div class="flex items-end justify-between mb-4">
			<h2 class="text-xl">Kategoriler</h2>
			<a href="/categories" class="text-xs text-[var(--color-copper)] hover:underline">Tümü →</a>
		</div>

		<div class="card divide-y divide-[var(--color-border)]">
			{#each data.counts as c}
				<a
					href="/categories/{c.slug}"
					class="flex items-center justify-between px-5 py-4 hover:bg-[var(--color-canvas)] transition-colors"
				>
					<div>
						<p style="font-family:var(--font-display);font-weight:400;font-size:1.05rem;">
							{c.name.tr}
						</p>
						<p class="text-xs text-[var(--color-muted)] mt-0.5">
							{c.name.en} · {c.name.ar}
						</p>
					</div>
					<div class="text-right">
						<p class="text-sm">
							<span class="text-[var(--color-ink)]">{c.published}</span>
							<span class="text-[var(--color-muted)]">/ {c.total} yayında</span>
						</p>
						<p class="text-xs text-[var(--color-muted)] mt-0.5">{c.slug}</p>
					</div>
				</a>
			{/each}
		</div>
	</section>
</div>
