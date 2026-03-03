<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		columns?: number;
		gap?: string;
		children: Snippet;
	}

	let { columns = 2, gap = '0.5rem', children }: Props = $props();
</script>

<div
	class="w-full"
	style="columns: {columns}; column-gap: {gap};"
>
	<div class="[&>*]:mb-2">
		{@render children()}
	</div>
</div>
