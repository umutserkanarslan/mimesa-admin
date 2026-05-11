<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Genel bakış · Mi Mesa Admin</title>
</svelte:head>

<header class="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
	<p class="eyebrow">Genel Bakış</p>
	<h1 class="mt-2 text-2xl sm:text-3xl">Sofranızın bugünkü durumu</h1>
</header>

<div class="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-5xl">
	<!-- Stats -->
	<div class="grid grid-cols-3 gap-2 sm:gap-5 mb-8 lg:mb-10">
		<div class="card p-3 sm:p-6">
			<p class="eyebrow text-[0.6rem] sm:text-[0.68rem]">Kategori</p>
			<p class="mt-2 sm:mt-3 text-2xl sm:text-4xl" style="font-family:var(--font-display);font-weight:400;">
				{data.stats.categories}
			</p>
		</div>
		<div class="card p-3 sm:p-6">
			<p class="eyebrow text-[0.6rem] sm:text-[0.68rem]">Ürün</p>
			<p class="mt-2 sm:mt-3 text-2xl sm:text-4xl" style="font-family:var(--font-display);font-weight:400;">
				{data.stats.items}
			</p>
		</div>
		<div class="card p-3 sm:p-6">
			<p class="eyebrow text-[0.6rem] sm:text-[0.68rem]">Yayında</p>
			<p class="mt-2 sm:mt-3 text-2xl sm:text-4xl whitespace-nowrap" style="font-family:var(--font-display);font-weight:400;">
				{data.stats.published}<span class="text-sm sm:text-base text-[var(--color-muted)]"> / {data.stats.items}</span>
			</p>
		</div>
	</div>

	<!-- Categories overview -->
	<section>
		<div class="flex items-end justify-between mb-4">
			<h2 class="text-lg sm:text-xl">Kategoriler</h2>
			<a href="/categories" class="text-xs text-[var(--color-copper)] hover:underline">Tümü →</a>
		</div>

		<div class="card divide-y divide-[var(--color-border)]">
			{#each data.counts as c}
				<a
					href="/categories/{c.slug}"
					class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 hover:bg-[var(--color-canvas)] transition-colors"
				>
					<div class="min-w-0 flex-1">
						<p class="truncate" style="font-family:var(--font-display);font-weight:400;font-size:1.05rem;">
							{c.name.tr}
						</p>
						<p class="text-xs text-[var(--color-muted)] mt-0.5 truncate">
							{c.name.en} · {c.name.ar}
						</p>
					</div>
					<div class="text-right flex-shrink-0">
						<p class="text-sm whitespace-nowrap">
							<span class="text-[var(--color-ink)]">{c.published}</span><span class="text-[var(--color-muted)]"> / {c.total}</span>
							<span class="text-[var(--color-muted)] hidden sm:inline"> yayında</span>
						</p>
						<p class="text-xs text-[var(--color-muted)] mt-0.5 truncate max-w-[10rem]">{c.slug}</p>
					</div>
				</a>
			{/each}
		</div>
	</section>
</div>
