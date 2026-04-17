<script lang="ts">
	import { goto } from '$app/navigation';
	import MasonryGrid from '$lib/components/MasonryGrid.svelte';
	import PinCard from '$lib/components/PinCard.svelte';
	import LoadingGrid from '$lib/components/LoadingGrid.svelte';
	import { useFollows } from '$lib/stores/follows.svelte.ts';
	import {
		buildFeedSources,
		fetchFeed,
		loadFeedCache,
		saveFeedCache,
		setLastSeenTopPin,
		countNewSinceLastSeen,
		type FeedSource
	} from '$lib/utils/feed.ts';
	import type { Pin } from '$lib/api/types.ts';

	const follows = useFollows();

	let pins = $state<Pin[]>([]);
	let fetchedAt = $state<number | null>(null);
	let loading = $state(false);
	let sourceErrors = $state<Record<string, string>>({});
	let hasLoadedOnce = $state(false);
	let initialized = false;

	const sources = $derived(
		buildFeedSources({
			users: follows.users,
			topics: follows.topics,
			boards: follows.boards
		})
	);

	const visiblePins = $derived(
		pins.filter(
			(p) => !follows.isPinHidden(p.id) && !follows.isPinnerHidden(p.pinner.username)
		)
	);

	const newCount = $derived(countNewSinceLastSeen(visiblePins));

	$effect(() => {
		if (initialized) return;
		initialized = true;
		const cache = loadFeedCache();
		if (cache) {
			pins = cache.pins;
			fetchedAt = cache.fetchedAt;
			hasLoadedOnce = true;
		}
		if (sources.length > 0 && shouldAutoRefresh(cache?.fetchedAt)) {
			refresh();
		}
	});

	function shouldAutoRefresh(ts: number | undefined): boolean {
		if (!ts) return true;
		// Refresh on open if cache is older than 30 minutes
		return Date.now() - ts > 30 * 60 * 1000;
	}

	async function refresh() {
		if (loading) return;
		if (sources.length === 0) return;
		loading = true;
		sourceErrors = {};
		try {
			const result = await fetchFeed(sources);
			pins = result.pins;
			fetchedAt = result.fetchedAt;
			sourceErrors = result.sourceErrors;
			hasLoadedOnce = true;
			saveFeedCache(
				pins,
				sources.map((s) => s.key)
			);
		} finally {
			loading = false;
		}
	}

	function handlePinClick(pin: Pin) {
		follows.markSeen(pin.id);
		if (visiblePins[0]) setLastSeenTopPin(visiblePins[0].id);
		goto(`/pin/${pin.id}`);
	}

	function handleUnfollowUser(username: string) {
		follows.unfollowUser(username);
	}
	function handleUnfollowTopic(query: string) {
		follows.unfollowTopic(query);
	}
	function handleUnfollowBoard(slug: string) {
		follows.unfollowBoard(slug);
	}

	function formatRelative(ts: number | null): string {
		if (!ts) return '';
		const diff = Date.now() - ts;
		if (diff < 60_000) return 'just now';
		if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
		return `${Math.floor(diff / 86_400_000)}d ago`;
	}

	// Pull-to-refresh (touch-only) on the <main> scroll container
	let pullDistance = $state(0);
	let pulling = $state(false);
	let startY = 0;
	let tracking = false;
	const PULL_THRESHOLD = 70;

	function scrollContainer(): Element | null {
		return typeof document !== 'undefined' ? document.querySelector('main') : null;
	}

	function onTouchStart(e: TouchEvent) {
		const c = scrollContainer();
		if (!c || c.scrollTop > 0) return;
		startY = e.touches[0].clientY;
		tracking = true;
		pulling = false;
		pullDistance = 0;
	}
	function onTouchMove(e: TouchEvent) {
		if (!tracking) return;
		const dy = e.touches[0].clientY - startY;
		if (dy <= 0) {
			pullDistance = 0;
			return;
		}
		pulling = true;
		// Rubber-band
		pullDistance = Math.min(dy * 0.5, 120);
	}
	function onTouchEnd() {
		if (!tracking) return;
		tracking = false;
		if (pullDistance >= PULL_THRESHOLD) {
			refresh();
		}
		pulling = false;
		pullDistance = 0;
	}

	// When user scrolls, mark the top of the current feed as "seen"
	let scrollTimer: ReturnType<typeof setTimeout> | null = null;
	function onScroll() {
		if (scrollTimer) return;
		scrollTimer = setTimeout(() => {
			scrollTimer = null;
			if (visiblePins[0]) setLastSeenTopPin(visiblePins[0].id);
		}, 600);
	}

	$effect(() => {
		const c = scrollContainer();
		if (!c) return;
		c.addEventListener('scroll', onScroll, { passive: true });
		return () => c.removeEventListener('scroll', onScroll);
	});
</script>

<svelte:head>
	<title>Feed - Pinfold</title>
</svelte:head>

<svelte:window ontouchstart={onTouchStart} ontouchmove={onTouchMove} ontouchend={onTouchEnd} ontouchcancel={onTouchEnd} />

<!-- Pull-to-refresh indicator -->
{#if pulling || loading}
	<div
		class="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center pt-2"
		style={pulling ? `transform: translateY(${Math.min(pullDistance, 70)}px);` : ''}
	>
		<div class="rounded-full bg-surface-container-high px-3 py-1.5 shadow-lg">
			{#if loading}
				<div class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
			{:else}
				<svg
					class="h-5 w-5 text-primary"
					style={`transform: rotate(${(pullDistance / PULL_THRESHOLD) * 180}deg);`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" />
				</svg>
			{/if}
		</div>
	</div>
{/if}

<div class="px-4 py-4">
	<div class="mb-4 flex items-center justify-between gap-2">
		<h1 class="text-2xl font-bold">Feed</h1>
		<div class="flex items-center gap-2">
			{#if newCount > 0 && hasLoadedOnce}
				<span class="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-on-primary">
					{newCount} new
				</span>
			{/if}
			<button
				onclick={refresh}
				disabled={loading || sources.length === 0}
				class="flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1.5 text-sm font-medium text-on-surface hover:bg-surface-bright disabled:opacity-50"
				aria-label="Refresh feed"
			>
				<svg class="h-4 w-4 {loading ? 'animate-spin' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" />
				</svg>
				Refresh
			</button>
		</div>
	</div>

	{#if follows.totalSources === 0}
		<div class="py-16 text-center">
			<svg class="mx-auto mb-4 h-16 w-16 text-on-surface-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path d="M4 6h16M4 12h16M4 18h10" />
			</svg>
			<p class="text-on-surface-dim">Your feed is empty</p>
			<p class="mx-auto mt-1 max-w-xs text-sm text-on-surface-dim">
				Follow a user, a board, or a search topic to start building your personal feed.
			</p>
			<button
				onclick={() => goto('/')}
				class="mt-6 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary"
			>
				Go to search
			</button>
		</div>
	{:else}
		<!-- Source chips -->
		<div class="mb-4 flex flex-wrap gap-2">
			{#each follows.users as u (u.username)}
				<button
					onclick={() => goto(`/user/${u.username}`)}
					class="flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1 text-xs text-on-surface-dim hover:bg-surface-container-high"
				>
					<span>@{u.username}</span>
					<span
						role="button"
						tabindex="0"
						class="text-on-surface-dim hover:text-error"
						onclick={(e) => { e.stopPropagation(); handleUnfollowUser(u.username); }}
						onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleUnfollowUser(u.username); } }}
						aria-label="Unfollow {u.username}"
					>×</span>
				</button>
			{/each}
			{#each follows.topics as t (t.query)}
				<button
					onclick={() => goto(`/search?q=${encodeURIComponent(t.query)}`)}
					class="flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1 text-xs text-on-surface-dim hover:bg-surface-container-high"
				>
					<span>#{t.query}</span>
					<span
						role="button"
						tabindex="0"
						class="text-on-surface-dim hover:text-error"
						onclick={(e) => { e.stopPropagation(); handleUnfollowTopic(t.query); }}
						onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleUnfollowTopic(t.query); } }}
						aria-label="Unfollow topic {t.query}"
					>×</span>
				</button>
			{/each}
			{#each follows.boards as b (b.slug)}
				<button
					onclick={() => goto(`/board/${b.slug}${b.id ? `?id=${b.id}` : ''}`)}
					class="flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1 text-xs text-on-surface-dim hover:bg-surface-container-high"
				>
					<span>📋 {b.name || b.slug}</span>
					<span
						role="button"
						tabindex="0"
						class="text-on-surface-dim hover:text-error"
						onclick={(e) => { e.stopPropagation(); handleUnfollowBoard(b.slug); }}
						onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleUnfollowBoard(b.slug); } }}
						aria-label="Unfollow board {b.slug}"
					>×</span>
				</button>
			{/each}
		</div>

		<!-- Status bar -->
		<div class="mb-3 flex items-center justify-between text-xs text-on-surface-dim">
			<span>
				{visiblePins.length} pin{visiblePins.length === 1 ? '' : 's'}
				{#if fetchedAt}· updated {formatRelative(fetchedAt)}{/if}
			</span>
			{#if Object.keys(sourceErrors).length > 0}
				<span class="text-amber-500">
					{Object.keys(sourceErrors).length} source{Object.keys(sourceErrors).length === 1 ? '' : 's'} failed
				</span>
			{/if}
		</div>

		{#if loading && !hasLoadedOnce}
			<LoadingGrid />
		{:else if visiblePins.length === 0}
			<div class="py-16 text-center">
				<p class="text-on-surface-dim">No pins loaded yet.</p>
				<button
					onclick={refresh}
					class="mt-4 rounded-full bg-surface-container-high px-4 py-2 text-sm hover:bg-surface-bright"
				>
					Try again
				</button>
			</div>
		{:else}
			<MasonryGrid>
				{#each visiblePins as pin (pin.id)}
					<PinCard {pin} showSeenOverlay onclick={() => handlePinClick(pin)} />
				{/each}
			</MasonryGrid>
		{/if}
	{/if}
</div>
