<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	const links = [
		{ href: '/', label: 'Genel bakış', match: (p: string) => p === '/' },
		{ href: '/categories', label: 'Kategoriler', match: (p: string) => p.startsWith('/categories') },
		{ href: '/items', label: 'Ürünler', match: (p: string) => p.startsWith('/items') }
	];
</script>

<div class="min-h-screen flex bg-[var(--color-canvas)]">
	<!-- Sidebar -->
	<aside
		class="w-60 shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col"
	>
		<div class="p-6 border-b border-[var(--color-border)]">
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

		<nav class="flex-1 p-3">
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
