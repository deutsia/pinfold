<script lang="ts">
	import { goto } from '$app/navigation';
	import MasonryGrid from '$lib/components/MasonryGrid.svelte';
	import PinCard from '$lib/components/PinCard.svelte';
	import { useHistory } from '$lib/stores/history.svelte.ts';
	import type { Pin } from '$lib/api/types.ts';

	const history = useHistory();

	function handlePinClick(pin: Pin) {
		goto(`/pin/${pin.id}`);
	}

	function handleDelete(pinId: string) {
		history.remove(pinId);
	}

	function confirmClear() {
		if (confirm('Clear your entire view history?')) {
			history.clear();
		}
	}

	// Group entries by day for nicer scanning
	function dayKey(ts: number): string {
		const d = new Date(ts);
		const today = new Date();
		const yest = new Date();
		yest.setDate(today.getDate() - 1);

		if (d.toDateString() === today.toDateString()) return 'Today';
		if (d.toDateString() === yest.toDateString()) return 'Yesterday';
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}

	const grouped = $derived.by(() => {
		const groups: { label: string; entries: typeof history.entries }[] = [];
		let currentLabel = '';
		for (const entry of history.entries) {
			const label = dayKey(entry.viewedAt);
			if (label !== currentLabel) {
				groups.push({ label, entries: [] });
				currentLabel = label;
			}
			groups[groups.length - 1].entries.push(entry);
		}
		return groups;
	});
</script>

<svelte:head>
	<title>History - Pinfold</title>
</svelte:head>

<div class="px-4 py-4">
	<button
		onclick={() => window.history.back()}
		class="mb-4 flex items-center gap-1 text-on-surface-dim hover:text-on-surface"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path d="m15 18-6-6 6-6" />
		</svg>
		Back
	</button>

	<div class="mb-4 flex items-center justify-between">
		<h1 class="text-2xl font-bold">History</h1>
		{#if history.count > 0}
			<button
				onclick={confirmClear}
				class="text-sm text-error hover:underline"
			>
				Clear all
			</button>
		{/if}
	</div>

	{#if history.count === 0}
		<div class="py-16 text-center">
			<svg class="mx-auto mb-4 h-16 w-16 text-on-surface-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<circle cx="12" cy="12" r="10" />
				<path d="M12 6v6l4 2" />
			</svg>
			<p class="text-on-surface-dim">No view history yet</p>
			<p class="mt-1 text-sm text-on-surface-dim">
				Pins you open will appear here.
			</p>
			<p class="mx-auto mt-3 max-w-xs text-xs text-on-surface-dim/80">
				Long-press any pin to delete it from history.
			</p>
		</div>
	{:else}
		<p class="mb-4 text-sm text-on-surface-dim">
			{history.count} pin{history.count === 1 ? '' : 's'} viewed · long-press to delete
		</p>

		{#each grouped as group (group.label)}
			<h2 class="sticky top-0 z-10 -mx-4 mb-3 bg-surface/95 px-4 py-2 text-sm font-semibold text-on-surface-dim backdrop-blur-sm">
				{group.label}
			</h2>
			<div class="mb-6">
				<MasonryGrid>
					{#each group.entries as entry (entry.pin.id)}
						<PinCard
							pin={entry.pin}
							onclick={() => handlePinClick(entry.pin)}
							onremove={() => handleDelete(entry.pin.id)}
							extraMenu={[{ label: 'Remove from history', danger: true, onclick: () => handleDelete(entry.pin.id) }]}
						/>
					{/each}
				</MasonryGrid>
			</div>
		{/each}
	{/if}
</div>
