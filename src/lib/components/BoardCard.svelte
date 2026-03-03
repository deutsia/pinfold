<script lang="ts">
	import { goto } from '$app/navigation';
	import type { Board } from '$lib/api/types.ts';
	import FetchImage from './FetchImage.svelte';

	interface Props {
		board: Board;
	}

	let { board }: Props = $props();

	let imageLoaded = $state(false);
	let imageError = $state(false);
</script>

<button
	class="w-full overflow-hidden rounded-2xl bg-surface-container text-left transition-colors hover:bg-surface-container-high"
	onclick={() => goto(`/board${board.url}?id=${board.id}`)}
>
	{#if board.imageUrl && !imageError}
		<div class="aspect-square w-full overflow-hidden bg-surface-container-high">
			{#if !imageLoaded}
				<div class="aspect-square w-full animate-pulse bg-surface-container-high"></div>
			{/if}
			<FetchImage
				src={board.imageUrl}
				alt={board.name}
				class="w-full object-cover {imageLoaded ? '' : 'hidden'}"
				onload={() => (imageLoaded = true)}
				onerror={() => (imageError = true)}
			/>
		</div>
	{:else}
		<div class="flex aspect-square w-full items-center justify-center bg-surface-container-high">
			<svg
				class="h-10 w-10 text-on-surface-dim"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<rect x="3" y="3" width="7" height="7" rx="1" />
				<rect x="14" y="3" width="7" height="7" rx="1" />
				<rect x="3" y="14" width="7" height="7" rx="1" />
				<rect x="14" y="14" width="7" height="7" rx="1" />
			</svg>
		</div>
	{/if}

	<div class="p-3">
		<p class="truncate font-medium">{board.name}</p>
		<p class="text-sm text-on-surface-dim">{board.pinCount} pins</p>
	</div>
</button>
