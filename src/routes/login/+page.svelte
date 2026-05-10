<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let submitting = $state(false);
</script>

<svelte:head>
	<title>Giriş · Mi Mesa Admin</title>
</svelte:head>

<main class="min-h-screen flex items-center justify-center px-6 py-16 bg-[var(--color-canvas)]">
	<div class="w-full max-w-sm">
		<div class="text-center mb-12">
			<a href="/" class="inline-flex items-baseline gap-2 group">
				<span
					class="text-2xl"
					style="font-family:var(--font-display);font-style:italic;font-weight:500;line-height:1;"
				>
					Mi&nbsp;Mesa
				</span>
				<span
					class="block w-6 h-px bg-[var(--color-copper)] opacity-70 transition-all duration-500 group-hover:w-12"
				></span>
			</a>
			<p class="eyebrow mt-4">Admin</p>
		</div>

		<form method="POST" action="?/signin" use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}} class="card p-8">
			<input type="hidden" name="redirect" value={data.redirectTo} />

			<div>
				<label for="email" class="label">E-posta</label>
				<input
					type="email"
					id="email"
					name="email"
					autocomplete="email"
					autofocus
					required
					value={form?.email ?? ''}
					class="input"
				/>
			</div>

			<div class="mt-5">
				<label for="password" class="label">Şifre</label>
				<input
					type="password"
					id="password"
					name="password"
					autocomplete="current-password"
					required
					class="input"
				/>
			</div>

			{#if form?.error}
				<p class="mt-5 text-sm text-[var(--color-danger)]">{form.error}</p>
			{/if}

			<button type="submit" disabled={submitting} class="btn btn-primary w-full justify-center mt-7">
				{submitting ? 'Giriş yapılıyor…' : 'Giriş yap'}
			</button>
		</form>

		<p class="mt-8 text-center text-xs text-[var(--color-muted)]">
			Yalnızca yetkili kullanıcılar.
		</p>
	</div>
</main>
