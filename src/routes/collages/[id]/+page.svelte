<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import MasonryGrid from '$lib/components/MasonryGrid.svelte';
	import PinCard from '$lib/components/PinCard.svelte';
	import { useCollages } from '$lib/stores/collages.svelte.ts';
	import { downloadPinImage } from '$lib/utils/download.ts';
	import { createPaste } from '$lib/utils/paste.ts';
	import { Share } from '@capacitor/share';
	import type { Pin } from '$lib/api/types.ts';

	const collages = useCollages();
	let collageId = $derived(page.params.id);
	let collage = $derived(collages.get(collageId));

	let editing = $state(false);
	let editName = $state('');
	let shareToast = $state(false);
	let shareToastMessage = $state('');
	let sharing = $state(false);
	let shareCode = $state<string | null>(null);
	let codeCopied = $state(false);

	// Multi-select state
	let selecting = $state(false);
	let selectedIds = $state<Set<string>>(new Set());
	let batchAction = $state<'idle' | 'deleting' | 'downloading'>('idle');
	let downloadProgress = $state('');

	// Delete collage confirmation
	let showDeleteCollage = $state(false);

	function startEdit() {
		if (!collage) return;
		editName = collage.name;
		editing = true;
	}

	function saveEdit() {
		if (!collage) return;
		const name = editName.trim();
		if (name) {
			collages.rename(collage.id, name);
		}
		editing = false;
	}

	function handleRemovePin(pinId: string) {
		if (!collage) return;
		collages.removePin(collage.id, pinId);
	}

	function handlePinClick(pin: Pin) {
		if (selecting) {
			toggleSelected(pin.id);
			return;
		}
		goto(`/pin/${pin.id}`);
	}

	function toggleSelecting() {
		selecting = !selecting;
		if (!selecting) {
			selectedIds = new Set();
		}
	}

	function toggleSelected(pinId: string) {
		const next = new Set(selectedIds);
		if (next.has(pinId)) {
			next.delete(pinId);
		} else {
			next.add(pinId);
		}
		selectedIds = next;
	}

	function selectAll() {
		if (!collage) return;
		selectedIds = new Set(collage.pins.map((p) => p.id));
	}

	function deselectAll() {
		selectedIds = new Set();
	}

	function deleteSelected() {
		if (!collage || selectedIds.size === 0) return;
		batchAction = 'deleting';
		for (const pinId of selectedIds) {
			collages.removePin(collage.id, pinId);
		}
		selectedIds = new Set();
		selecting = false;
		batchAction = 'idle';
	}

	async function downloadSelected() {
		if (!collage || selectedIds.size === 0) return;
		batchAction = 'downloading';
		const pins = collage.pins.filter((p) => selectedIds.has(p.id));
		let done = 0;

		for (const pin of pins) {
			downloadProgress = `Downloading ${++done}/${pins.length}...`;
			try {
				await downloadPinImage(pin);
			} catch {
				// Skip failed downloads
			}
		}

		downloadProgress = '';
		batchAction = 'idle';
		shareToastMessage = `Saved ${done} image${done === 1 ? '' : 's'} to Downloads`;
		shareToast = true;
		setTimeout(() => (shareToast = false), 2000);
		selectedIds = new Set();
		selecting = false;
	}

	function handleDeleteCollage() {
		if (!collage) return;
		collages.delete(collage.id);
		goto('/collages');
	}

	async function handleShare() {
		if (!collage || collage.pins.length === 0 || sharing) return;
		sharing = true;

		try {
			const payload = JSON.stringify({
				n: collage.name,
				p: collage.pins.map((pin) => pin.id)
			});
			const pasteKey = await createPaste(payload);

			const deepLink = `pinfold://import/${pasteKey}`;
			const shareText = `Check out my Pinfold collage "${collage.name}" (${collage.pins.length} pins)\n\n${deepLink}\n\nOr paste this import code in Pinfold > Collages > Import: ${pasteKey}`;
			try {
				await Share.share({
					title: `${collage.name} - Pinfold Collage`,
					text: shareText,
					url: deepLink
				});
			} catch {
				// User cancelled share sheet — ignore
			}
			// Always show the import code so the user can copy it
			shareCode = pasteKey;
			codeCopied = false;
		} catch {
			shareToastMessage = 'Failed to create share link';
			shareToast = true;
			setTimeout(() => (shareToast = false), 2000);
		} finally {
			sharing = false;
		}
	}

	async function copyCode() {
		if (!shareCode) return;
		try {
			await navigator.clipboard.writeText(shareCode);
			codeCopied = true;
		} catch {
			// Fallback: select-all trick won't work here, just show toast
			shareToastMessage = 'Could not copy to clipboard';
			shareToast = true;
			setTimeout(() => (shareToast = false), 2000);
		}
	}
</script>

<svelte:head>
	<title>{collage?.name || 'Collage'} - Pinfold</title>
</svelte:head>

<div class="px-4 py-4">
	<!-- Back button -->
	<button
		onclick={() => history.back()}
		class="mb-4 flex items-center gap-1 text-on-surface-dim hover:text-on-surface"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path d="m15 18-6-6 6-6" />
		</svg>
		Back
	</button>

	{#if !collage}
		<div class="py-12 text-center">
			<p class="text-on-surface-dim">Collage not found</p>
			<button
				onclick={() => goto('/collages')}
				class="mt-4 rounded-full bg-surface-container-high px-4 py-2 text-sm hover:bg-surface-bright"
			>
				View all collages
			</button>
		</div>
	{:else}
		<!-- Header -->
		<div class="mb-4">
			{#if editing}
				<form onsubmit={(e) => { e.preventDefault(); saveEdit(); }} class="flex gap-2">
					<input
						type="text"
						bind:value={editName}
						autofocus
						class="flex-1 rounded-xl bg-surface-container-high px-4 py-2 text-xl font-bold text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
					/>
					<button
						type="submit"
						class="rounded-xl bg-primary px-4 py-2 font-medium text-on-primary"
					>
						Save
					</button>
				</form>
			{:else}
				<div class="flex items-center gap-2">
					<h1 class="flex-1 text-2xl font-bold">{collage.name}</h1>
					<button
						onclick={startEdit}
						class="rounded-full p-2 text-on-surface-dim hover:text-on-surface"
						title="Rename"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
						</svg>
					</button>
					{#if collage.pins.length > 0}
						<button
							onclick={toggleSelecting}
							class="rounded-full p-2 {selecting ? 'text-primary' : 'text-on-surface-dim hover:text-on-surface'}"
							title={selecting ? 'Cancel selection' : 'Select pins'}
						>
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
							</svg>
						</button>
						<button
							onclick={handleShare}
							disabled={sharing}
							class="rounded-full p-2 text-on-surface-dim hover:text-on-surface {sharing ? 'animate-pulse' : ''}"
							title="Share collage"
						>
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
								<path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
							</svg>
						</button>
					{/if}
					<button
						onclick={() => (showDeleteCollage = true)}
						class="rounded-full p-2 text-on-surface-dim hover:text-error"
						title="Delete collage"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
					</button>
				</div>
			{/if}
			<p class="mt-1 text-sm text-on-surface-dim">
				{collage.pins.length} pin{collage.pins.length === 1 ? '' : 's'}
				<span class="ml-2 text-on-surface-dim/60">Private</span>
			</p>
		</div>

		<!-- Multi-select toolbar -->
		{#if selecting}
			<div class="mb-4 flex items-center gap-2 rounded-xl bg-surface-container p-3">
				<span class="flex-1 text-sm font-medium">
					{selectedIds.size} selected
				</span>
				<button
					onclick={selectedIds.size === collage.pins.length ? deselectAll : selectAll}
					class="rounded-lg px-3 py-1.5 text-xs font-medium text-on-surface-dim hover:bg-surface-container-high"
				>
					{selectedIds.size === collage.pins.length ? 'Deselect all' : 'Select all'}
				</button>
				{#if selectedIds.size > 0}
					<button
						onclick={downloadSelected}
						disabled={batchAction !== 'idle'}
						class="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary disabled:opacity-50"
					>
						{batchAction === 'downloading' ? downloadProgress : 'Download'}
					</button>
					<button
						onclick={deleteSelected}
						disabled={batchAction !== 'idle'}
						class="rounded-lg bg-error px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
					>
						Delete
					</button>
				{/if}
			</div>
		{/if}

		{#if collage.pins.length === 0}
			<div class="py-12 text-center">
				<svg
					class="mx-auto mb-4 h-12 w-12 text-on-surface-dim"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
					<rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
				</svg>
				<p class="text-on-surface-dim">This collage is empty</p>
				<p class="mt-1 text-sm text-on-surface-dim">Add pins from any pin's detail page</p>
			</div>
		{:else}
			<MasonryGrid>
				{#each collage.pins as pin (pin.id)}
					<div class="group relative">
						<PinCard {pin} onclick={() => handlePinClick(pin)} />
						{#if selecting}
							<!-- Selection checkbox overlay -->
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								onclick={() => toggleSelected(pin.id)}
								class="absolute inset-0 rounded-2xl {selectedIds.has(pin.id) ? 'bg-primary/20 ring-2 ring-primary' : ''}"
							>
								<div class="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full {selectedIds.has(pin.id) ? 'bg-primary text-white' : 'bg-black/50 text-white'}">
									{#if selectedIds.has(pin.id)}
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
											<path d="M5 13l4 4L19 7" />
										</svg>
									{/if}
								</div>
							</div>
						{:else}
							<button
								onclick={() => handleRemovePin(pin.id)}
								class="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 active:opacity-100"
								title="Remove from collage"
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path d="M6 18 18 6M6 6l12 12" />
								</svg>
							</button>
						{/if}
					</div>
				{/each}
			</MasonryGrid>
		{/if}
	{/if}
</div>

<!-- Delete collage confirmation -->
{#if showDeleteCollage}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={() => (showDeleteCollage = false)}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="mx-4 w-full max-w-sm rounded-2xl bg-surface-container p-6"
			onclick={(e) => e.stopPropagation()}
		>
			<h2 class="text-lg font-semibold">Delete collage?</h2>
			<p class="mt-2 text-sm text-on-surface-dim">
				"{collage?.name}" and all {collage?.pins.length} pin{collage?.pins.length === 1 ? '' : 's'} in it will be removed. This can't be undone.
			</p>
			<div class="mt-4 flex justify-end gap-2">
				<button
					onclick={() => (showDeleteCollage = false)}
					class="rounded-xl px-4 py-2 text-sm font-medium text-on-surface-dim hover:bg-surface-container-high"
				>
					Cancel
				</button>
				<button
					onclick={handleDeleteCollage}
					class="rounded-xl bg-error px-4 py-2 text-sm font-medium text-white"
				>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Share code modal -->
{#if shareCode}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={() => (shareCode = null)}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="mx-4 w-full max-w-sm rounded-2xl bg-surface-container p-6"
			onclick={(e) => e.stopPropagation()}
		>
			<h2 class="text-lg font-semibold">Share code</h2>
			<p class="mt-2 text-sm text-on-surface-dim">
				Send this code to someone. They can import it via Collages &rarr; Import.
			</p>
			<div class="mt-3 flex items-center gap-2 rounded-xl bg-surface-container-high px-4 py-3">
				<code class="flex-1 select-all break-all text-sm font-mono">{shareCode}</code>
				<button
					onclick={copyCode}
					class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium {codeCopied ? 'bg-primary text-on-primary' : 'bg-surface-bright text-on-surface hover:bg-surface-container'}"
				>
					{codeCopied ? 'Copied' : 'Copy'}
				</button>
			</div>
			<div class="mt-4 flex justify-end">
				<button
					onclick={() => (shareCode = null)}
					class="rounded-xl px-4 py-2 text-sm font-medium text-on-surface-dim hover:bg-surface-container-high"
				>
					Done
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Toast -->
{#if shareToast}
	<div class="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium shadow-lg">
		{shareToastMessage}
	</div>
{/if}
