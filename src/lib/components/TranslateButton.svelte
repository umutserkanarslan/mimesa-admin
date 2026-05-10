<script lang="ts">
	interface Result {
		en: { name?: string; tagline?: string; description?: string };
		ar: { name?: string; tagline?: string; description?: string };
	}

	interface Props {
		getInput: () => { name?: string; tagline?: string; description?: string };
		onResult: (result: Result) => void;
		label?: string;
	}

	let { getInput, onResult, label = "TR'den çevir" }: Props = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);

	async function run() {
		const fields = getInput();
		if (!fields.name && !fields.tagline && !fields.description) {
			error = 'Önce TR alan(lar)ını doldur.';
			return;
		}

		busy = true;
		error = null;
		try {
			const res = await fetch('/api/translate', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ fields })
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data?.message ?? `HTTP ${res.status}`);
			}
			const data = (await res.json()) as Result;
			onResult(data);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Çeviri hatası.';
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex items-center gap-3 flex-wrap">
	<button type="button" onclick={run} disabled={busy} class="btn btn-secondary text-xs">
		{#if busy}
			<span class="inline-block w-3 h-3 border-2 border-[var(--color-copper)] border-t-transparent rounded-full animate-spin"></span>
			Çevriliyor…
		{:else}
			✨ {label}
		{/if}
	</button>
	{#if error}
		<span class="text-xs text-[var(--color-danger)]">{error}</span>
	{/if}
</div>
