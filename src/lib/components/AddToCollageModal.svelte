<script lang="ts">
	import type { Pin } from '$lib/api/types.ts';
	import { useCollages } from '$lib/stores/collages.svelte.ts';

	interface Props {
		pin: Pin;
		onclose: () => void;
	}

	let { pin, onclose }: Props = $props();

	const collages = useCollages();
	let newName = $state('');
	let showCreate = $state(false);
	let addedTo = $state<string | null>(null);

	function handleCreate() {
		const name = newName.trim();
		if (!name) return;
		const collage = collages.create(name);
		collages.addPin(collage.id, pin);
		addedTo = collage.id;
		newName = '';
		showCreate = false;
		setTimeout(onclose, 600);
	}

	function handleAdd(collageId: string) {
		const added = collages.addPin(collageId, pin);
		if (added) {
			addedTo = collageId;
			setTimeout(onclose, 600);
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 sm:items-center"
	onclick={handleBackdropClick}
>
	<div class="w-full max-w-md rounded-t-3xl bg-surface-container p-5 sm:rounded-3xl">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold">Save to collage</h2>
			<button onclick={onclose} class="rounded-full p-1 text-on-surface-dim hover:text-on-surface">
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M6 18 18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Collage list -->
		<div class="max-h-64 space-y-2 overflow-y-auto">
			{#each collages.collages as collage (collage.id)}
				{@const alreadyIn = collages.isPinIn(collage.id, pin.id)}
				{@const justAdded = addedTo === collage.id}
				<button
					onclick={() => handleAdd(collage.id)}
					disabled={alreadyIn}
					class="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors
						{justAdded ? 'bg-primary/20' : alreadyIn ? 'opacity-50' : 'hover:bg-surface-container-high'}"
				>
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
						style="background-color: {collage.coverColor}"
					>
						{collage.pins.length}
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate font-medium">{collage.name}</p>
						<p class="text-xs text-on-surface-dim">
							{collage.pins.length} pin{collage.pins.length === 1 ? '' : 's'}
						</p>
					</div>
					{#if justAdded}
						<svg class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M5 13l4 4L19 7" />
						</svg>
					{:else if alreadyIn}
						<span class="text-xs text-on-surface-dim">Added</span>
					{/if}
				</button>
			{/each}

			{#if collages.collages.length === 0 && !showCreate}
				<p class="py-4 text-center text-sm text-on-surface-dim">No collages yet. Create one below!</p>
			{/if}
		</div>

		<!-- Create new collage -->
		{#if showCreate}
			<form onsubmit={(e) => { e.preventDefault(); handleCreate(); }} class="mt-3 flex gap-2">
				<input
					type="text"
					bind:value={newName}
					placeholder="Collage name"
					autofocus
					class="flex-1 rounded-xl bg-surface-container-high px-4 py-2.5 text-on-surface placeholder:text-on-surface-dim focus:ring-2 focus:ring-primary focus:outline-none"
				/>
				<button
					type="submit"
					disabled={!newName.trim()}
					class="rounded-xl bg-primary px-4 py-2.5 font-medium text-on-primary disabled:opacity-50"
				>
					Create
				</button>
			</form>
		{:else}
			<button
				onclick={() => (showCreate = true)}
				class="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-outline-dim py-3 text-on-surface-dim transition-colors hover:border-primary hover:text-primary"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M12 5v14M5 12h14" />
				</svg>
				New collage
			</button>
		{/if}
	</div>
</div>
