<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import UserCard from '$lib/components/UserCard.svelte';
	import MasonryGrid from '$lib/components/MasonryGrid.svelte';
	import PinCard from '$lib/components/PinCard.svelte';
	import BoardCard from '$lib/components/BoardCard.svelte';
	import LoadingGrid from '$lib/components/LoadingGrid.svelte';
	import { getUserProfile, getUserPins, getUserBoards } from '$lib/api/pinterest.ts';
	import type { Pin, UserProfile, Board } from '$lib/api/types.ts';

	let username = $derived(page.params.username);
	let user = $state<UserProfile | null>(null);
	let pins = $state<Pin[]>([]);
	let pinsBookmark = $state<string | null>(null);
	let boards = $state<Board[]>([]);
	let boardsBookmark = $state<string | null>(null);
	let boardsLoaded = $state(false);
	let activeTab = $state<'pins' | 'boards'>('pins');
	let loading = $state(true);
	let loadingMore = $state(false);
	let loadingBoards = $state(false);
	let error = $state<string | null>(null);
	let boardsError = $state<string | null>(null);
	let lastUsername = '';

	$effect(() => {
		if (username && username !== lastUsername) {
			lastUsername = username;
			activeTab = 'pins';
			boardsLoaded = false;
			boards = [];
			boardsBookmark = null;
			boardsError = null;
			loadUser(username);
		}
	});

	async function loadUser(uname: string) {
		loading = true;
		error = null;

		try {
			const [profile, pinsResult] = await Promise.all([getUserProfile(uname), getUserPins(uname)]);

			if (!profile) {
				error = `User "${uname}" not found`;
				return;
			}

			user = profile;
			pins = pinsResult.pins;
			pinsBookmark = pinsResult.bookmark;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load user';
		} finally {
			loading = false;
		}
	}

	async function loadBoards(uname: string) {
		if (loadingBoards) return;
		loadingBoards = true;
		boardsError = null;

		try {
			const result = await getUserBoards(uname);
			boards = result.boards;
			boardsBookmark = result.bookmark;
			boardsLoaded = true;
		} catch (e) {
			boardsError = e instanceof Error ? e.message : 'Failed to load boards';
		} finally {
			loadingBoards = false;
		}
	}

	function switchToBoards() {
		activeTab = 'boards';
		if (!boardsLoaded && !loadingBoards) {
			loadBoards(username);
		}
	}

	async function loadMorePins() {
		if (!pinsBookmark || loadingMore) return;
		loadingMore = true;

		try {
			const result = await getUserPins(username, pinsBookmark);
			pins = [...pins, ...result.pins];
			pinsBookmark = result.bookmark;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load more';
		} finally {
			loadingMore = false;
		}
	}

	async function loadMoreBoards() {
		if (!boardsBookmark || loadingMore) return;
		loadingMore = true;

		try {
			const result = await getUserBoards(username, boardsBookmark);
			boards = [...boards, ...result.boards];
			boardsBookmark = result.bookmark;
		} catch (e) {
			boardsError = e instanceof Error ? e.message : 'Failed to load more boards';
		} finally {
			loadingMore = false;
		}
	}
</script>

<svelte:head>
	<title>{user?.fullName || username} - Pinfold</title>
</svelte:head>

<div class="px-4 py-4">
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
			<div
				class="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
			></div>
		</div>
	{:else if error}
		<div class="py-12 text-center">
			<p class="text-error">{error}</p>
			<button
				onclick={() => loadUser(username)}
				class="mt-4 rounded-full bg-surface-container-high px-4 py-2 text-sm hover:bg-surface-bright"
			>
				Try again
			</button>
		</div>
	{:else}
		{#if user}
			<UserCard {user} />
		{/if}

		<!-- Tabs -->
		<div class="mb-4 mt-6 flex border-b border-outline-variant">
			<button
				onclick={() => (activeTab = 'pins')}
				class="px-5 pb-3 text-sm font-medium transition-colors {activeTab === 'pins'
					? 'border-b-2 border-primary text-primary'
					: 'text-on-surface-dim hover:text-on-surface'}"
			>
				Pins
			</button>
			<button
				onclick={switchToBoards}
				class="px-5 pb-3 text-sm font-medium transition-colors {activeTab === 'boards'
					? 'border-b-2 border-primary text-primary'
					: 'text-on-surface-dim hover:text-on-surface'}"
			>
				Boards{user && user.boardCount > 0 ? ` (${user.boardCount})` : ''}
			</button>
		</div>

		{#if activeTab === 'pins'}
			<MasonryGrid>
				{#each pins as pin (pin.id)}
					<PinCard {pin} onclick={() => goto(`/pin/${pin.id}`)} />
				{/each}
			</MasonryGrid>

			{#if pinsBookmark}
				<div class="py-6 text-center">
					<button
						onclick={loadMorePins}
						disabled={loadingMore}
						class="rounded-full bg-surface-container-high px-6 py-2 text-sm hover:bg-surface-bright disabled:opacity-50"
					>
						{loadingMore ? 'Loading...' : 'Load more'}
					</button>
				</div>
			{/if}
		{:else}
			{#if loadingBoards}
				<div class="flex justify-center py-12">
					<div
						class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
					></div>
				</div>
			{:else if boardsError}
				<div class="py-12 text-center">
					<p class="text-error">{boardsError}</p>
					<button
						onclick={() => { boardsLoaded = false; loadBoards(username); }}
						class="mt-4 rounded-full bg-surface-container-high px-4 py-2 text-sm hover:bg-surface-bright"
					>
						Try again
					</button>
				</div>
			{:else if boards.length === 0}
				<p class="py-12 text-center text-on-surface-dim">No boards found</p>
			{:else}
				<div class="grid grid-cols-2 gap-3">
					{#each boards as board (board.id)}
						<BoardCard {board} />
					{/each}
				</div>

				{#if boardsBookmark}
					<div class="py-6 text-center">
						<button
							onclick={loadMoreBoards}
							disabled={loadingMore}
							class="rounded-full bg-surface-container-high px-6 py-2 text-sm hover:bg-surface-bright disabled:opacity-50"
						>
							{loadingMore ? 'Loading...' : 'Load more'}
						</button>
					</div>
				{/if}
			{/if}
		{/if}
	{/if}
</div>
