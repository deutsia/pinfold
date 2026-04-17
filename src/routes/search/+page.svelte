<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import MasonryGrid from '$lib/components/MasonryGrid.svelte';
	import PinCard from '$lib/components/PinCard.svelte';
	import LoadingGrid from '$lib/components/LoadingGrid.svelte';
	import { searchPins } from '$lib/api/pinterest.ts';
	import { addToHistory } from '$lib/stores/search.svelte.ts';
	import { useFollows } from '$lib/stores/follows.svelte.ts';
	import { parsePinterestUrl } from '$lib/utils/url-parser.ts';
	import type { Pin } from '$lib/api/types.ts';

	const follows = useFollows();

	let query = $derived(page.url.searchParams.get('q') || '');
	let topicFollowed = $derived(!!query && follows.isTopicFollowed(query));

	function toggleFollowTopic() {
		if (!query) return;
		if (follows.isTopicFollowed(query)) {
			follows.unfollowTopic(query);
		} else {
			follows.followTopic(query);
		}
	}

	let pins = $state<Pin[]>([]);
	let bookmark = $state<string | null>(null);
	let loading = $state(false);
	let loadingMore = $state(false);
	let error = $state<string | null>(null);
	let searchInput = $state('');

	// Track the last searched query to avoid duplicate fetches
	let lastQuery = '';

	$effect(() => {
		if (query && query !== lastQuery) {
			lastQuery = query;
			searchInput = query;
			doSearch(query);
		}
	});

	async function doSearch(q: string) {
		loading = true;
		error = null;
		pins = [];
		bookmark = null;

		try {
			const result = await searchPins(q);
			pins = result.pins;
			bookmark = result.bookmark;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Search failed';
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (!bookmark || loadingMore) return;

		loadingMore = true;
		try {
			const result = await searchPins(query, bookmark);
			pins = [...pins, ...result.pins];
			bookmark = result.bookmark;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load more';
		} finally {
			loadingMore = false;
		}
	}

	function handleNewSearch(q: string) {
		const parsed = parsePinterestUrl(q);
		if (parsed) {
			goto(parsed);
			return;
		}
		addToHistory(q);
		goto(`/search?q=${encodeURIComponent(q)}`);
	}

	function handlePinClick(pin: Pin) {
		goto(`/pin/${pin.id}`);
	}

	// Infinite scroll: listen for scroll events on the actual scroll container
	// (the <main> element with overflow-y-auto in the layout).
	// Using a scroll listener instead of IntersectionObserver because the
	// observer with root:null (viewport) doesn't reliably detect the sentinel
	// inside a nested scroll container in Capacitor WebViews.
	let sentinel = $state<HTMLElement | null>(null);
	let scrollContainer: Element | null = null;

	function checkShouldLoadMore() {
		if (!scrollContainer || !bookmark || loadingMore || loading) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
		if (scrollHeight - scrollTop - clientHeight < 500) {
			loadMore();
		}
	}

	// Set up scroll listener when sentinel appears
	$effect(() => {
		if (!sentinel) return;
		scrollContainer = sentinel.closest('main');
		if (!scrollContainer) return;

		scrollContainer.addEventListener('scroll', checkShouldLoadMore, { passive: true });
		// Check immediately in case content doesn't fill the viewport
		checkShouldLoadMore();

		return () => {
			scrollContainer?.removeEventListener('scroll', checkShouldLoadMore);
			scrollContainer = null;
		};
	});

	// After loading finishes, re-check if more content is needed.
	// This handles the case where loaded content still doesn't fill
	// the scroll container, so we keep loading until it does.
	$effect(() => {
		if (!loadingMore && bookmark && pins.length > 0) {
			tick().then(() => checkShouldLoadMore());
		}
	});
</script>

<svelte:head>
	<title>{query ? `${query} - Pinfold` : 'Search - Pinfold'}</title>
</svelte:head>

<div>
	<!-- Search bar -->
	<div class="sticky top-0 z-10 bg-surface/95 px-4 pt-4 pb-3 backdrop-blur-sm">
		<SearchBar bind:value={searchInput} onsubmit={handleNewSearch} />
		{#if query}
			<div class="mt-2 flex justify-end">
				<button
					onclick={toggleFollowTopic}
					class="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors {topicFollowed
						? 'bg-surface-container-high text-on-surface'
						: 'bg-primary text-on-primary'}"
				>
					{#if topicFollowed}
						<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M5 13l4 4L19 7" />
						</svg>
						Following #{query}
					{:else}
						<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M12 5v14M5 12h14" />
						</svg>
						Follow #{query}
					{/if}
				</button>
			</div>
		{/if}
	</div>

	<div class="px-4">
		{#if loading}
			<LoadingGrid />
		{:else if error}
			<div class="py-12 text-center">
				<p class="text-error">{error}</p>
				<button
					onclick={() => doSearch(query)}
					class="mt-4 rounded-full bg-surface-container-high px-4 py-2 text-sm hover:bg-surface-bright"
				>
					Try again
				</button>
			</div>
		{:else if pins.length === 0 && query}
			<div class="py-12 text-center">
				<p class="text-on-surface-dim">No results found for "{query}"</p>
			</div>
		{:else}
			<MasonryGrid>
				{#each pins as pin (pin.id)}
					<PinCard {pin} onclick={() => handlePinClick(pin)} />
				{/each}
			</MasonryGrid>

			<!-- Sentinel element for infinite scroll -->
			{#if bookmark}
				<div bind:this={sentinel} class="h-1"></div>
			{/if}

			{#if loadingMore}
				<div class="py-8 text-center">
					<div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
				</div>
			{/if}

			{#if !bookmark && pins.length > 0}
				<p class="py-8 text-center text-sm text-on-surface-dim">No more results</p>
			{/if}
		{/if}
	</div>
</div>
