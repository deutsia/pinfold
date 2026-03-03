<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import PinDetail from '$lib/components/PinDetail.svelte';
	import MasonryGrid from '$lib/components/MasonryGrid.svelte';
	import PinCard from '$lib/components/PinCard.svelte';
	import LoadingGrid from '$lib/components/LoadingGrid.svelte';
	import { getPin, getRelatedPins } from '$lib/api/pinterest.ts';
	import type { Pin } from '$lib/api/types.ts';

	let pinId = $derived(page.params.id);
	let pin = $state<Pin | null>(null);
	let relatedPins = $state<Pin[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let lastPinId = '';

	$effect(() => {
		if (pinId && pinId !== lastPinId) {
			lastPinId = pinId;
			loadPin(pinId);
		}
	});

	async function loadPin(id: string) {
		loading = true;
		error = null;

		try {
			const [pinData, related] = await Promise.all([
				getPin(id),
				getRelatedPins(id)
			]);
			pin = pinData;
			relatedPins = related.pins;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load pin';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>{pin?.title || 'Pin'} - Pinfold</title>
</svelte:head>

<div class="px-4 py-4">
	<!-- Back button -->
	<button
		onclick={() => history.back()}
		class="mb-4 flex items-center gap-1 text-on-surface-dim hover:text-on-surface"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path d="m15 18-6-6 6-6" />
		</svg>
		Back
	</button>

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
		</div>
	{:else if error}
		<div class="py-12 text-center">
			<p class="text-error">{error}</p>
			<button
				onclick={() => loadPin(pinId)}
				class="mt-4 rounded-full bg-surface-container-high px-4 py-2 text-sm hover:bg-surface-bright"
			>
				Try again
			</button>
		</div>
	{:else if pin}
		<PinDetail {pin} />

		<!-- Related pins -->
		{#if relatedPins.length > 0}
			<div class="mt-8">
				<h2 class="mb-4 text-lg font-semibold">Related pins</h2>
				<MasonryGrid>
					{#each relatedPins as relPin (relPin.id)}
						<PinCard pin={relPin} onclick={() => goto(`/pin/${relPin.id}`)} />
					{/each}
				</MasonryGrid>
			</div>
		{/if}
	{:else}
		<div class="py-12 text-center">
			<p class="text-on-surface-dim">Pin not found</p>
		</div>
	{/if}
</div>
