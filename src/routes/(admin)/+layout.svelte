<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { afterNavigate } from '$app/navigation';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	const links = [
		{ href: '/', label: 'Genel bakış', match: (p: string) => p === '/' },
		{ href: '/categories', label: 'Kategoriler', match: (p: string) => p.startsWith('/categories') },
		{ href: '/items', label: 'Ürünler', match: (p: string) => p.startsWith('/items') }
	];

	let drawerOpen = $state(false);

	afterNavigate(() => {
		drawerOpen = false;
	});

	const activeLabel = $derived(
		links.find((l) => l.match(page.url.pathname))?.label ?? 'Admin'
	);
</script>

<div class="min-h-screen lg:flex bg-[var(--color-canvas)]">
	<!-- Mobile top bar -->
	<header
		class="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 h-14 px-4 bg-[var(--color-surface)] border-b border-[var(--color-border)]"
	>
		<button
			type="button"
			onclick={() => (drawerOpen = true)}
			class="p-2 -ml-2 text-[var(--color-ink)] hover:text-[var(--color-copper)] transition-colors"
			aria-label="Menüyü aç"
		>
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
				<path d="M4 7h16M4 12h16M4 17h16" />
			</svg>
		</button>
		<a href="/" class="inline-flex items-baseline gap-2">
			<span class="text-lg" style="font-family:var(--font-display);font-style:italic;font-weight:500;line-height:1;">
				Mi&nbsp;Mesa
			</span>
			<span class="block w-3 h-px bg-[var(--color-copper)] opacity-70"></span>
		</a>
		<span class="text-xs text-[var(--color-muted)] truncate max-w-[40vw] text-right">{activeLabel}</span>
	</header>

	<!-- Backdrop -->
	{#if drawerOpen}
		<button
			type="button"
			class="lg:hidden fixed inset-0 z-40 bg-black/40"
			onclick={() => (drawerOpen = false)}
			aria-label="Menüyü kapat"
		></button>
	{/if}

	<!-- Sidebar (drawer on mobile, sticky on desktop) -->
	<aside
		class="fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 w-64 lg:w-60 shrink-0 h-screen bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col transition-transform duration-300 ease-out lg:transform-none {drawerOpen
			? 'translate-x-0'
			: '-translate-x-full lg:translate-x-0'}"
	>
		<div class="p-6 border-b border-[var(--color-border)] flex items-start justify-between gap-2">
			<div>
				<a href="/" class="inline-flex items-baseline gap-2 group">
					<span
						class="text-xl"
						style="font-family:var(--font-display);font-style:italic;font-weight:500;line-height:1;"
					>
						Mi&nbsp;Mesa
					</span>
					<span
						class="block w-4 h-px bg-[var(--color-copper)] opacity-70 transition-all duration-500 group-hover:w-8"
					></span>
				</a>
				<p class="eyebrow mt-1">Admin</p>
			</div>
			<button
				type="button"
				onclick={() => (drawerOpen = false)}
				class="lg:hidden -mr-2 -mt-2 p-2 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
				aria-label="Kapat"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
					<path d="M6 6l12 12M6 18L18 6" />
				</svg>
			</button>
		</div>

		<nav class="flex-1 p-3 overflow-y-auto">
			<ul class="space-y-1">
				{#each links as l}
					{@const active = l.match(page.url.pathname)}
					<li>
						<a
							href={l.href}
							class="block px-3 py-2 text-sm transition-colors {active
								? 'bg-[var(--color-champagne-soft)] text-[var(--color-ink)] border-l-2 border-[var(--color-copper)] -ml-px pl-[calc(0.75rem-1px)]'
								: 'text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)]'}"
						>
							{l.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<div class="p-4 border-t border-[var(--color-border)]">
			<p class="text-xs text-[var(--color-muted)] truncate" title={data.user?.email}>
				{data.user?.email}
			</p>
			<form method="POST" action="/logout" use:enhance class="mt-2">
				<button type="submit" class="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors">
					Çıkış yap
				</button>
			</form>
		</div>
	</aside>

	<!-- Main -->
	<main class="flex-1 min-w-0">
		{@render children()}
	</main>
</div>
