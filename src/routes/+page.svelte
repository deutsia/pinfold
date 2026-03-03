<script lang="ts">
	import { goto } from '$app/navigation';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { useSearchHistory } from '$lib/stores/search.svelte.ts';
	import { parsePinterestUrl } from '$lib/utils/url-parser.ts';

	const searchHistory = useSearchHistory();
	let query = $state('');

	function handleSearch(q: string) {
		const parsed = parsePinterestUrl(q);
		if (parsed) {
			goto(parsed);
			return;
		}
		searchHistory.add(q);
		goto(`/search?q=${encodeURIComponent(q)}`);
	}

	function searchFromHistory(q: string) {
		query = q;
		handleSearch(q);
	}
</script>

<svelte:head>
	<title>Pinfold</title>
</svelte:head>

<div class="flex min-h-full flex-col items-center justify-center px-4">
	<div class="w-full max-w-md">
		<!-- Logo / Title -->
		<div class="mb-8 text-center">
			<h1 class="text-4xl font-bold text-primary">Pinfold</h1>
			<p class="mt-2 text-sm text-on-surface-dim">Private Pinterest browsing</p>
		</div>

		<!-- Search -->
		<SearchBar bind:value={query} onsubmit={handleSearch} autofocus />

		<!-- Search History -->
		{#if searchHistory.history.length > 0}
			<div class="mt-6">
				<div class="mb-2 flex items-center justify-between">
					<h2 class="text-sm font-medium text-on-surface-dim">Recent searches</h2>
					<button
						onclick={() => searchHistory.clear()}
						class="text-xs text-on-surface-dim hover:text-on-surface"
					>
						Clear all
					</button>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each searchHistory.history as item}
						<button
							onclick={() => searchFromHistory(item)}
							class="rounded-full bg-surface-container-high px-3 py-1.5 text-sm text-on-surface transition-colors hover:bg-surface-bright"
						>
							{item}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
