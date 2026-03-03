<script lang="ts">
	interface Props {
		count?: number;
		columns?: number;
	}

	let { count = 8, columns = 2 }: Props = $props();

	// Generate random aspect ratios for visual variety
	const items = Array.from({ length: count }, (_, i) => ({
		id: i,
		height: 150 + Math.random() * 150
	}));
</script>

<div class="w-full" style="columns: {columns}; column-gap: 0.5rem;">
	{#each items as item}
		<div
			class="mb-2 animate-pulse break-inside-avoid rounded-2xl bg-surface-container"
			style="height: {item.height}px"
		></div>
	{/each}
</div>
