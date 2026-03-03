<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import MasonryGrid from '$lib/components/MasonryGrid.svelte';
	import PinCard from '$lib/components/PinCard.svelte';
	import LoadingGrid from '$lib/components/LoadingGrid.svelte';
	import { getBoardPins } from '$lib/api/pinterest.ts';
	import type { Pin } from '$lib/api/types.ts';

	let slug = $derived(page.params.slug);
	let boardId = $derived(page.url.searchParams.get('id') || undefined);
	let pins = $state<Pin[]>([]);
	let bookmark = $state<string | null>(null);
	let loading = $state(true);
	let loadingMore = $state(false);
	let error = $state<string | null>(null);
	let lastSlug = '';

	$effect(() => {
		if (slug && slug !== lastSlug) {
			lastSlug = slug;
			loadBoard(slug);
		}
	});

	async function loadBoard(boardSlug: string) {
		loading = true;
		error = null;

		try {
			const result = await getBoardPins(boardSlug, undefined, boardId);
			pins = result.pins;
			bookmark = result.bookmark;
		} catch (e) {
			console.error('[Board] Load failed:', e);
			error = e instanceof Error ? e.message : 'Failed to load board';
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (!bookmark || loadingMore) return;
		loadingMore = true;

		try {
			const result = await getBoardPins(slug, bookmark, boardId);
			pins = [...pins, ...result.pins];
			bookmark = result.bookmark;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load more';
		} finally {
			loadingMore = false;
		}
	}
</script>

<svelte:head>
	<title>Board - Pinfold</title>
</svelte:head>

<div class="px-4 py-4">
	<button
		onclick={() => history.back()}
		class="mb-4 flex items-center gap-1 text-on-surface-dim hover:text-on-surface"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path d="m15 18-6-6 6-6" />
		</svg>
		Back
	</button>

	<h1 class="mb-4 text-2xl font-bold">{slug.split('/').pop() || 'Board'}</h1>

	{#if loading}
		<LoadingGrid />
	{:else if error}
		<div class="py-12 text-center">
			<p class="text-error">{error}</p>
			<button
				onclick={() => loadBoard(slug)}
				class="mt-4 rounded-full bg-surface-container-high px-4 py-2 text-sm hover:bg-surface-bright"
			>
				Try again
			</button>
		</div>
	{:else if pins.length === 0}
		<div class="py-12 text-center">
			<p class="text-on-surface-dim">No pins found in this board</p>
			<button
				onclick={() => loadBoard(slug)}
				class="mt-4 rounded-full bg-surface-container-high px-4 py-2 text-sm hover:bg-surface-bright"
			>
				Try again
			</button>
		</div>
	{:else}
		<MasonryGrid>
			{#each pins as pin (pin.id)}
				<PinCard {pin} onclick={() => goto(`/pin/${pin.id}`)} />
			{/each}
		</MasonryGrid>

		{#if bookmark}
			<div class="py-6 text-center">
				<button
					onclick={loadMore}
					disabled={loadingMore}
					class="rounded-full bg-surface-container-high px-6 py-2 text-sm hover:bg-surface-bright disabled:opacity-50"
				>
					{loadingMore ? 'Loading...' : 'Load more'}
				</button>
			</div>
		{/if}
	{/if}
</div>
