<script lang="ts">
	import FetchImage from './FetchImage.svelte';
	import { longpress } from '$lib/utils/long-press.ts';

	interface Props {
		src: string;
		alt?: string;
		onclose: () => void;
		onlongpress?: () => void;
	}

	let { src, alt = 'Full size image', onclose, onlongpress }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
	onclick={handleBackdropClick}
>
	<!-- Close button -->
	<button
		onclick={onclose}
		class="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white"
	>
		<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path d="M6 18 18 6M6 6l12 12" />
		</svg>
	</button>

	{#if onlongpress}
		<div use:longpress={{ onLongPress: onlongpress }}>
			<FetchImage
				{src}
				{alt}
				class="max-h-[90vh] max-w-[95vw] object-contain"
			/>
		</div>
	{:else}
		<FetchImage
			{src}
			{alt}
			class="max-h-[90vh] max-w-[95vw] object-contain"
		/>
	{/if}
</div>
