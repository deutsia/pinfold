<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import MasonryGrid from '$lib/components/MasonryGrid.svelte';
	import PinCard from '$lib/components/PinCard.svelte';
	import LoadingGrid from '$lib/components/LoadingGrid.svelte';
	import { decodeCollageShare, duplicateCollage, MAX_COLLAGE_NAME_LENGTH, MAX_SHARED_PINS } from '$lib/stores/collages.svelte.ts';
	import { fetchPaste } from '$lib/utils/paste.ts';
	import { getPin } from '$lib/api/pinterest.ts';
	import type { Pin } from '$lib/api/types.ts';

	// Support both old base64 ?data= and new ?paste= params
	let shareData = $derived(page.url.searchParams.get('data') || '');
	let pasteCode = $derived(page.url.searchParams.get('paste') || '');
	let autoImport = $derived(page.url.searchParams.get('auto') === '1');

	let collageName = $state('');
	let pins = $state<Pin[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let loadedCount = $state(0);
	let totalCount = $state(0);
	let duplicated = $state(false);

	let lastData = '';

	$effect(() => {
		const key = pasteCode || shareData;
		if (key && key !== lastData) {
			lastData = key;
			if (pasteCode) {
				loadFromPaste(pasteCode);
			} else {
				loadSharedCollage(shareData);
			}
		}
	});

	async function loadFromPaste(code: string) {
		loading = true;
		error = null;
		pins = [];
		loadedCount = 0;
		duplicated = false;

		try {
			const rawContent = await fetchPaste(code);
			const parsed = JSON.parse(rawContent);
			if (typeof parsed.n !== 'string' || !Array.isArray(parsed.p)) {
				throw new Error('Invalid collage data format');
			}

			// Apply the same limits and pin ID validation as decodeCollageShare.
			const PIN_ID_RE = /^\d{1,20}$/;
			collageName = parsed.n.slice(0, MAX_COLLAGE_NAME_LENGTH);
			const pinIds: string[] = (parsed.p as unknown[])
				.slice(0, MAX_SHARED_PINS)
				.map(String)
				.filter((id) => PIN_ID_RE.test(id));
			totalCount = pinIds.length;

			if (pinIds.length === 0) {
				loading = false;
				return;
			}

			await fetchPins(pinIds);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load shared collage';
		} finally {
			loading = false;
		}
	}

	async function loadSharedCollage(data: string) {
		loading = true;
		error = null;
		pins = [];
		loadedCount = 0;
		duplicated = false;

		const decoded = decodeCollageShare(data);
		if (!decoded) {
			error = 'Invalid collage link. The data may be corrupted.';
			loading = false;
			return;
		}

		collageName = decoded.name;
		totalCount = decoded.pinIds.length;

		if (decoded.pinIds.length === 0) {
			loading = false;
			return;
		}

		await fetchPins(decoded.pinIds);
		loading = false;
	}

	async function fetchPins(pinIds: string[]) {
		const batchSize = 4;
		const loadedPins: Pin[] = [];

		for (let i = 0; i < pinIds.length; i += batchSize) {
			const batch = pinIds.slice(i, i + batchSize);
			const results = await Promise.allSettled(
				batch.map((id) => getPin(id))
			);

			for (const result of results) {
				if (result.status === 'fulfilled' && result.value) {
					loadedPins.push(result.value);
				}
				loadedCount++;
			}

			pins = [...loadedPins];
		}

		if (loadedPins.length === 0) {
			error = 'Could not load any pins from this collage.';
		}
	}

	// Auto-import: when opened via deep link, duplicate as soon as pins load
	$effect(() => {
		if (autoImport && !loading && !duplicated && !error && pins.length > 0) {
			handleDuplicate();
		}
	});

	function handleDuplicate() {
		if (pins.length === 0 || duplicated) return;
		const collage = duplicateCollage(collageName, pins);
		duplicated = true;
		setTimeout(() => goto(`/collages/${collage.id}`), 500);
	}

	function handlePinClick(pin: Pin) {
		goto(`/pin/${pin.id}`);
	}
</script>

<svelte:head>
	<title>{collageName || 'Shared Collage'} - Pinfold</title>
</svelte:head>

<div class="px-4 py-4">
	<!-- Back button -->
	<button
		onclick={() => goto('/collages')}
		class="mb-4 flex items-center gap-1 text-on-surface-dim hover:text-on-surface"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path d="m15 18-6-6 6-6" />
		</svg>
		My Collages
	</button>

	{#if error}
		<div class="py-12 text-center">
			<svg
				class="mx-auto mb-4 h-12 w-12 text-error"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<circle cx="12" cy="12" r="10" />
				<path d="M12 8v4M12 16h.01" />
			</svg>
			<p class="text-error">{error}</p>
			<button
				onclick={() => loadSharedCollage(shareData)}
				class="mt-4 rounded-full bg-surface-container-high px-4 py-2 text-sm hover:bg-surface-bright"
			>
				Try again
			</button>
		</div>
	{:else}
		<!-- Header -->
		<div class="mb-4">
			<div class="flex items-center gap-2">
				<h1 class="flex-1 text-2xl font-bold">{collageName || 'Loading...'}</h1>
			</div>

			<!-- Shared badge + info -->
			<div class="mt-1 flex items-center gap-2">
				<span class="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
					<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
						<path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
					</svg>
					Shared with you
				</span>
				{#if !loading}
					<span class="text-sm text-on-surface-dim">
						{pins.length} pin{pins.length === 1 ? '' : 's'}
					</span>
				{/if}
			</div>

			<!-- Duplicate & Edit button -->
			{#if pins.length > 0 && !loading}
				<button
					onclick={handleDuplicate}
					disabled={duplicated}
					class="mt-3 flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium transition-colors
						{duplicated
							? 'bg-primary/20 text-primary'
							: 'bg-primary text-on-primary active:scale-[0.98]'}"
				>
					{#if duplicated}
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M5 13l4 4L19 7" />
						</svg>
						Duplicated! Redirecting...
					{:else}
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
						</svg>
						Duplicate & Edit
					{/if}
				</button>
				<p class="mt-1.5 text-xs text-on-surface-dim">
					Saves a copy to your collages that you can edit
				</p>
			{/if}
		</div>

		<!-- Loading progress -->
		{#if loading}
			<div class="mb-4">
				<div class="mb-2 flex items-center justify-between text-sm text-on-surface-dim">
					<span>Loading pins...</span>
					<span>{loadedCount}/{totalCount}</span>
				</div>
				<div class="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
					<div
						class="h-full rounded-full bg-primary transition-all duration-300"
						style="width: {totalCount > 0 ? (loadedCount / totalCount) * 100 : 0}%"
					></div>
				</div>
			</div>
		{/if}

		<!-- Pins grid (shows progressively as they load) -->
		{#if pins.length > 0}
			<MasonryGrid>
				{#each pins as pin (pin.id)}
					<PinCard {pin} onclick={() => handlePinClick(pin)} />
				{/each}
			</MasonryGrid>
		{:else if loading}
			<LoadingGrid />
		{:else}
			<div class="py-12 text-center">
				<p class="text-on-surface-dim">This collage is empty</p>
			</div>
		{/if}
	{/if}
</div>
