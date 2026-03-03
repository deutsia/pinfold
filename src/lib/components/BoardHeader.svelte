<script lang="ts">
	import type { Board } from '$lib/api/types.ts';
	import FetchImage from './FetchImage.svelte';

	interface Props {
		board: Board;
	}

	let { board }: Props = $props();
</script>

<div class="px-4 py-6 text-center">
	{#if board.imageUrl}
		<FetchImage
			src={board.imageUrl}
			alt={board.name}
			class="mx-auto mb-4 h-24 w-24 rounded-2xl object-cover"
		/>
	{/if}

	<h1 class="text-2xl font-bold">{board.name}</h1>

	{#if board.description}
		<p class="mt-2 text-on-surface-dim">{board.description}</p>
	{/if}

	<div class="mt-3 flex items-center justify-center gap-4 text-sm text-on-surface-dim">
		<span>{board.pinCount} pins</span>
		{#if board.owner.username}
			<a href="/user/{board.owner.username}" class="text-primary hover:underline">
				{board.owner.fullName || board.owner.username}
			</a>
		{/if}
	</div>
</div>
