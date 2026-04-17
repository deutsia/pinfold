<script lang="ts">
	import { goto } from '$app/navigation';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { useSearchHistory } from '$lib/stores/search.svelte.ts';
	import { parsePinterestUrl } from '$lib/utils/url-parser.ts';
	import { Haptics, ImpactStyle } from '@capacitor/haptics';

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

	// ===== Long-press & drag-to-trash for recent searches =====
	const LONG_PRESS_MS = 450;

	let dragging = $state<string | null>(null);
	let dragX = $state(0);
	let dragY = $state(0);
	let dragOverTrash = $state(false);

	let trashEl: HTMLDivElement | undefined = $state();
	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let activeItem: string | null = null;
	let startX = 0;
	let startY = 0;
	let suppressClickFor: string | null = null;

	function pointXY(e: TouchEvent | PointerEvent): { x: number; y: number } {
		if ('touches' in e) {
			const t = e.touches[0] ?? e.changedTouches[0];
			return { x: t.clientX, y: t.clientY };
		}
		return { x: e.clientX, y: e.clientY };
	}

	function startPress(item: string, e: TouchEvent | PointerEvent) {
		const { x, y } = pointXY(e);
		startX = x;
		startY = y;
		activeItem = item;
		dragX = x;
		dragY = y;
		cancelPressTimer();
		pressTimer = setTimeout(() => {
			dragging = item;
			suppressClickFor = item;
			Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
		}, LONG_PRESS_MS);
	}

	function cancelPressTimer() {
		if (pressTimer) {
			clearTimeout(pressTimer);
			pressTimer = null;
		}
	}

	function movePress(e: TouchEvent | PointerEvent) {
		if (!activeItem) return;
		const { x, y } = pointXY(e);

		if (!dragging) {
			if (Math.abs(x - startX) > 10 || Math.abs(y - startY) > 10) {
				cancelPressTimer();
				activeItem = null;
			}
			return;
		}

		dragX = x;
		dragY = y;
		if (trashEl) {
			const rect = trashEl.getBoundingClientRect();
			const over =
				x >= rect.left - 20 &&
				x <= rect.right + 20 &&
				y >= rect.top - 20 &&
				y <= rect.bottom + 20;
			if (over !== dragOverTrash) {
				dragOverTrash = over;
				if (over) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
			}
		}
	}

	function endPress() {
		cancelPressTimer();
		if (dragging && dragOverTrash) {
			searchHistory.remove(dragging);
			Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
		}
		dragging = null;
		dragOverTrash = false;
		activeItem = null;
	}

	function handleClick(e: MouseEvent, item: string) {
		if (suppressClickFor === item) {
			e.preventDefault();
			e.stopPropagation();
			suppressClickFor = null;
			return;
		}
		searchFromHistory(item);
	}
</script>

<svelte:head>
	<title>Pinfold</title>
</svelte:head>

<svelte:window
	ontouchmove={movePress}
	ontouchend={endPress}
	ontouchcancel={endPress}
	onpointermove={(e) => {
		if (activeItem) movePress(e);
	}}
	onpointerup={endPress}
	onpointercancel={endPress}
/>

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
				<p class="mb-2 text-[11px] text-on-surface-dim/80">
					Tip: long-press and drag to the trash to delete a single search.
				</p>
				<div class="flex flex-wrap gap-2">
					{#each searchHistory.history as item (item)}
						<button
							onclick={(e) => handleClick(e, item)}
							ontouchstart={(e) => startPress(item, e)}
							onpointerdown={(e) => {
								if (e.pointerType === 'mouse') startPress(item, e);
							}}
							class="touch-none rounded-full bg-surface-container-high px-3 py-1.5 text-sm text-on-surface transition-all
								{dragging === item ? 'invisible' : 'hover:bg-surface-bright'}"
						>
							{item}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Floating drag preview -->
{#if dragging}
	<div
		class="pointer-events-none fixed z-[120] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-on-primary shadow-2xl"
		style="left: {dragX}px; top: {dragY}px;"
	>
		{dragging}
	</div>
{/if}

<!-- Trash drop zone -->
{#if dragging}
	<div
		bind:this={trashEl}
		class="pointer-events-none fixed bottom-28 left-1/2 z-[115] -translate-x-1/2 rounded-full p-4 transition-all
			{dragOverTrash
				? 'scale-125 bg-error text-white shadow-2xl'
				: 'bg-surface-container-high text-on-surface-dim shadow-lg'}"
	>
		<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
		</svg>
	</div>
{/if}
