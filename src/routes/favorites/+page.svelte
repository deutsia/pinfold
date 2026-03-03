<script lang="ts">
	import { goto } from '$app/navigation';
	import MasonryGrid from '$lib/components/MasonryGrid.svelte';
	import PinCard from '$lib/components/PinCard.svelte';
	import { useFavorites } from '$lib/stores/favorites.svelte.ts';
	import type { Pin } from '$lib/api/types.ts';

	const favorites = useFavorites();

	function handlePinClick(pin: Pin) {
		goto(`/pin/${pin.id}`);
	}
</script>

<svelte:head>
	<title>Favorites - Pinfold</title>
</svelte:head>

<div class="px-4 py-4">
	<h1 class="mb-4 text-2xl font-bold">Favorites</h1>

	{#if favorites.pins.length === 0}
		<div class="py-16 text-center">
			<svg
				class="mx-auto mb-4 h-16 w-16 text-on-surface-dim"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
			</svg>
			<p class="text-on-surface-dim">No favorites yet</p>
			<p class="mt-1 text-sm text-on-surface-dim">Save pins you like and they'll appear here</p>
		</div>
	{:else}
		<p class="mb-4 text-sm text-on-surface-dim">{favorites.count} saved pin{favorites.count === 1 ? '' : 's'}</p>
		<MasonryGrid>
			{#each favorites.pins as pin (pin.id)}
				<PinCard {pin} onclick={() => handlePinClick(pin)} />
			{/each}
		</MasonryGrid>
	{/if}
</div>
