<script lang="ts">
	import { goto } from '$app/navigation';
	import { useCollages, duplicateCollage, decodeCollageShare } from '$lib/stores/collages.svelte.ts';
	import { fetchPaste } from '$lib/utils/paste.ts';
	import { getPin } from '$lib/api/pinterest.ts';
	import FetchImage from '$lib/components/FetchImage.svelte';
	import { selectImageSize } from '$lib/api/image-proxy.ts';
	import type { Pin } from '$lib/api/types.ts';

	const collages = useCollages();
	let showCreate = $state(false);
	let newName = $state('');
	let deleteConfirm = $state<string | null>(null);

	// Import state
	let showImport = $state(false);
	let importCode = $state('');
	let importing = $state(false);
	let importError = $state<string | null>(null);
	let importProgress = $state('');

	function handleCreate() {
		const name = newName.trim();
		if (!name) return;
		const collage = collages.create(name);
		newName = '';
		showCreate = false;
		goto(`/collages/${collage.id}`);
	}

	function handleDelete(id: string) {
		collages.delete(id);
		deleteConfirm = null;
	}

	async function handleImport() {
		const code = importCode.trim();
		if (!code || importing) return;
		importing = true;
		importError = null;
		importProgress = 'Fetching collage data...';

		try {
			let rawContent: string;
			try {
				rawContent = await fetchPaste(code);
			} catch {
				// Maybe it's an old-style base64 share code
				const decoded = decodeCollageShare(code);
				if (decoded) {
					rawContent = JSON.stringify({ n: decoded.name, p: decoded.pinIds });
				} else {
					throw new Error('Invalid import code. Check and try again.');
				}
			}

			const parsed = JSON.parse(rawContent);
			if (typeof parsed.n !== 'string' || !Array.isArray(parsed.p)) {
				throw new Error('Invalid collage data format');
			}

			const collageName: string = parsed.n;
			const pinIds: string[] = parsed.p.map(String);

			if (pinIds.length === 0) {
				throw new Error('This collage has no pins');
			}

			const loadedPins: Pin[] = [];
			const batchSize = 4;

			for (let i = 0; i < pinIds.length; i += batchSize) {
				const batch = pinIds.slice(i, i + batchSize);
				const results = await Promise.allSettled(
					batch.map((id) => getPin(id))
				);

				for (const result of results) {
					if (result.status === 'fulfilled' && result.value) {
						loadedPins.push(result.value);
					}
				}

				importProgress = `Loading pins (${Math.min(i + batchSize, pinIds.length)}/${pinIds.length})...`;
			}

			if (loadedPins.length === 0) {
				throw new Error('Could not load any pins from this collage');
			}

			const collage = duplicateCollage(collageName, loadedPins);
			showImport = false;
			importCode = '';
			importProgress = '';
			goto(`/collages/${collage.id}`);
		} catch (e) {
			importError = e instanceof Error ? e.message : 'Import failed';
			importProgress = '';
		} finally {
			importing = false;
		}
	}
</script>

<svelte:head>
	<title>Collages - Pinfold</title>
</svelte:head>

<div class="px-4 py-4">
	<div class="mb-4 flex items-center justify-between">
		<h1 class="text-2xl font-bold">Collages</h1>
		<div class="flex gap-2">
			<button
				onclick={() => { showImport = !showImport; showCreate = false; }}
				class="rounded-full bg-surface-container-high p-2.5 text-on-surface-dim transition-transform active:scale-95"
				title="Import collage"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
					<rect x="8" y="2" width="8" height="4" rx="1" />
				</svg>
			</button>
			<button
				onclick={() => { showCreate = !showCreate; showImport = false; }}
				class="rounded-full bg-primary p-2.5 text-on-primary shadow-lg transition-transform active:scale-95"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M12 5v14M5 12h14" />
				</svg>
			</button>
		</div>
	</div>

	<!-- Import collage form -->
	{#if showImport}
		<div class="mb-6 rounded-2xl bg-surface-container p-4">
			<p class="mb-2 text-sm font-medium">Import a shared collage</p>
			<form onsubmit={(e) => { e.preventDefault(); handleImport(); }} class="flex gap-2">
				<input
					type="text"
					bind:value={importCode}
					placeholder="Paste import code..."
					autofocus
					disabled={importing}
					class="flex-1 rounded-xl bg-surface-container-high px-4 py-3 text-on-surface placeholder:text-on-surface-dim focus:ring-2 focus:ring-primary focus:outline-none"
				/>
				<button
					type="submit"
					disabled={!importCode.trim() || importing}
					class="rounded-xl bg-primary px-5 py-3 font-medium text-on-primary disabled:opacity-50"
				>
					{importing ? '...' : 'Import'}
				</button>
			</form>
			{#if importProgress}
				<p class="mt-2 text-xs text-on-surface-dim">{importProgress}</p>
			{/if}
			{#if importError}
				<p class="mt-2 text-xs text-error">{importError}</p>
			{/if}
		</div>
	{/if}

	<!-- Create new collage form -->
	{#if showCreate}
		<form onsubmit={(e) => { e.preventDefault(); handleCreate(); }} class="mb-6 flex gap-2">
			<input
				type="text"
				bind:value={newName}
				placeholder="Collage name..."
				autofocus
				class="flex-1 rounded-xl bg-surface-container-high px-4 py-3 text-on-surface placeholder:text-on-surface-dim focus:ring-2 focus:ring-primary focus:outline-none"
			/>
			<button
				type="submit"
				disabled={!newName.trim()}
				class="rounded-xl bg-primary px-5 py-3 font-medium text-on-primary disabled:opacity-50"
			>
				Create
			</button>
		</form>
	{/if}

	{#if collages.collages.length === 0}
		<div class="py-16 text-center">
			<svg
				class="mx-auto mb-4 h-16 w-16 text-on-surface-dim"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
				<rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
			</svg>
			<p class="text-on-surface-dim">No collages yet</p>
			<p class="mt-1 text-sm text-on-surface-dim">Create a collage to group your favorite pins together</p>
			<button
				onclick={() => (showCreate = true)}
				class="mt-4 rounded-full bg-primary px-6 py-2.5 font-medium text-on-primary"
			>
				Create your first collage
			</button>
		</div>
	{:else}
		<div class="space-y-3">
			{#each collages.collages as collage (collage.id)}
				<div class="relative">
					<button
						onclick={() => goto(`/collages/${collage.id}`)}
						class="w-full overflow-hidden rounded-2xl bg-surface-container transition-colors hover:bg-surface-container-high"
					>
						<!-- Cover: show first 4 pins as grid preview, or colored fallback -->
						{#if collage.pins.length > 0}
							<div class="grid grid-cols-4 gap-0.5">
								{#each collage.pins.slice(0, 4) as pin, i (pin.id)}
									<div class="aspect-square overflow-hidden {i === 0 && collage.pins.length < 4 ? 'col-span-2 row-span-2' : ''}">
										<FetchImage
											src={selectImageSize(pin.images, 'grid')}
											alt=""
											class="h-full w-full object-cover"
										/>
									</div>
								{/each}
								{#if collage.pins.length < 4}
									{#each Array(4 - Math.min(collage.pins.length, 4)) as _}
										<div class="aspect-square" style="background-color: {collage.coverColor}20"></div>
									{/each}
								{/if}
							</div>
						{:else}
							<div class="flex h-24 items-center justify-center" style="background-color: {collage.coverColor}20">
								<div
									class="flex h-12 w-12 items-center justify-center rounded-xl text-white"
									style="background-color: {collage.coverColor}"
								>
									<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path d="M12 5v14M5 12h14" />
									</svg>
								</div>
							</div>
						{/if}

						<!-- Info -->
						<div class="flex items-center justify-between p-3">
							<div class="text-left">
								<p class="font-semibold">{collage.name}</p>
								<p class="text-xs text-on-surface-dim">
									{collage.pins.length} pin{collage.pins.length === 1 ? '' : 's'}
								</p>
							</div>
							<svg class="h-5 w-5 text-on-surface-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path d="m9 18 6-6-6-6" />
							</svg>
						</div>
					</button>

					<!-- Delete button -->
					{#if deleteConfirm === collage.id}
						<div class="absolute top-2 right-2 flex gap-1">
							<button
								onclick={() => handleDelete(collage.id)}
								class="rounded-lg bg-error px-3 py-1.5 text-xs font-medium text-white"
							>
								Delete
							</button>
							<button
								onclick={() => (deleteConfirm = null)}
								class="rounded-lg bg-surface-container-high px-3 py-1.5 text-xs font-medium"
							>
								Cancel
							</button>
						</div>
					{:else}
						<button
							onclick={() => (deleteConfirm = collage.id)}
							class="absolute top-2 right-2 rounded-full bg-black/40 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/60 [div:hover>&]:opacity-100"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
