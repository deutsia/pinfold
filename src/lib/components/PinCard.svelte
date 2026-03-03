<script lang="ts">
	import type { Pin } from '$lib/api/types.ts';
	import { selectImageSize } from '$lib/api/image-proxy.ts';
	import { downloadPinImage } from '$lib/utils/download.ts';
	import { isFavorited, toggleFavorite } from '$lib/stores/favorites.svelte.ts';
	import FetchImage from './FetchImage.svelte';

	interface Props {
		pin: Pin;
		onclick?: () => void;
	}

	let { pin, onclick }: Props = $props();

	let imageLoaded = $state(false);
	let imageError = $state(false);
	let currentSlide = $state(0);
	let scrollContainer: HTMLDivElement | undefined = $state();
	let showMenu = $state(false);
	let saving = $state(false);
	let saveStatus = $state<'idle' | 'success' | 'error'>('idle');
	let favorited = $state(isFavorited(pin.id));

	const imgSrc = $derived(selectImageSize(pin.images, 'grid'));
	const isCarousel = $derived(pin.carouselImages.length > 1);
	const totalSlides = $derived(isCarousel ? pin.carouselImages.length : 1);

	function handleScroll() {
		if (!scrollContainer) return;
		const scrollLeft = scrollContainer.scrollLeft;
		const slideWidth = scrollContainer.clientWidth;
		currentSlide = Math.round(scrollLeft / slideWidth);
	}

	// Long-press detection using touch events (pointer events get cancelled
	// by scroll containers on Android)
	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let didLongPress = false;
	let touchStartX = 0;
	let touchStartY = 0;
	const MOVE_THRESHOLD = 10; // px — allow small finger drift

	function handleTouchStart(e: TouchEvent) {
		didLongPress = false;
		const touch = e.touches[0];
		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
		pressTimer = setTimeout(() => {
			didLongPress = true;
			showMenu = true;
		}, 500);
	}

	function handleTouchMove(e: TouchEvent) {
		if (!pressTimer) return;
		const touch = e.touches[0];
		const dx = Math.abs(touch.clientX - touchStartX);
		const dy = Math.abs(touch.clientY - touchStartY);
		if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
			clearTimeout(pressTimer);
			pressTimer = null;
		}
	}

	function handleTouchEnd() {
		if (pressTimer) {
			clearTimeout(pressTimer);
			pressTimer = null;
		}
	}

	function handleClick() {
		if (didLongPress) {
			didLongPress = false;
			return;
		}
		onclick?.();
	}

	function closeMenu() {
		showMenu = false;
	}

	function handleToggleFavorite() {
		favorited = toggleFavorite(pin);
		showMenu = false;
	}

	async function handleSaveImage() {
		if (saving) return;
		saving = true;
		saveStatus = 'idle';
		showMenu = false;

		try {
			await downloadPinImage(pin, isCarousel ? currentSlide : undefined);
			saveStatus = 'success';
			setTimeout(() => { saveStatus = 'idle'; }, 2000);
		} catch {
			saveStatus = 'error';
			setTimeout(() => { saveStatus = 'idle'; }, 2000);
		} finally {
			saving = false;
		}
	}
</script>

<div class="relative w-full overflow-hidden rounded-2xl bg-surface-container break-inside-avoid">
	{#if isCarousel}
		<!-- Carousel: horizontal scroll with snap -->
		<div
			bind:this={scrollContainer}
			onscroll={handleScroll}
			class="flex w-full snap-x snap-mandatory overflow-x-auto"
			style="scrollbar-width: none; -webkit-overflow-scrolling: touch;"
		>
			{#each pin.carouselImages as slideImages, i (i)}
				<div class="w-full flex-shrink-0 snap-center">
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="cursor-pointer"
						onclick={handleClick}
						ontouchstart={handleTouchStart}
						ontouchmove={handleTouchMove}
						ontouchend={handleTouchEnd}
						ontouchcancel={handleTouchEnd}
						oncontextmenu={(e) => e.preventDefault()}
						style="-webkit-touch-callout: none; touch-action: pan-x pan-y;"
					>
						<FetchImage
							src={selectImageSize(slideImages, 'grid')}
							alt="{pin.title || pin.description || 'Pin image'} ({i + 1}/{totalSlides})"
							class="w-full"
							onload={() => { if (i === 0) imageLoaded = true; }}
							onerror={() => { if (i === 0) imageError = true; }}
						/>
					</div>
				</div>
			{/each}
		</div>

		<!-- Dot indicators -->
		{#if totalSlides > 1}
			<div class="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
				{#each pin.carouselImages as _, i (i)}
					<div
						class="h-1.5 rounded-full transition-all duration-200 {currentSlide === i
							? 'w-4 bg-white'
							: 'w-1.5 bg-white/50'}"
					></div>
				{/each}
			</div>
		{/if}

		<!-- Slide counter badge -->
		<div class="absolute top-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white pointer-events-none">
			{currentSlide + 1}/{totalSlides}
		</div>
	{:else}
		<!-- Single image pin (original behavior) -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="group relative w-full cursor-pointer"
			onclick={handleClick}
			ontouchstart={handleTouchStart}
			ontouchmove={handleTouchMove}
			ontouchend={handleTouchEnd}
			ontouchcancel={handleTouchEnd}
			oncontextmenu={(e) => e.preventDefault()}
			style="-webkit-touch-callout: none; touch-action: pan-x pan-y;"
		>
			{#if !imageLoaded && !imageError}
				<div
					class="aspect-[3/4] w-full animate-pulse"
					style="background-color: {pin.dominantColor}"
				></div>
			{/if}

			{#if imageError}
				<div class="flex aspect-[3/4] items-center justify-center bg-surface-container-high">
					<span class="text-sm text-on-surface-dim">Failed to load</span>
				</div>
			{:else}
				<FetchImage
					src={imgSrc}
					alt={pin.title || pin.description || 'Pin image'}
					class="w-full"
					onload={() => (imageLoaded = true)}
					onerror={() => (imageError = true)}
				/>
			{/if}

			{#if pin.title || pin.description}
				<div
					class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100"
				>
					<p class="line-clamp-2 text-sm text-white">
						{pin.title || pin.description}
					</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Title overlay for carousel pins -->
	{#if isCarousel && (pin.title || pin.description)}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 pointer-events-none"
			style="bottom: 0;"
		>
			<p class="line-clamp-2 text-sm text-white mb-3">
				{pin.title || pin.description}
			</p>
		</div>
	{/if}

	<!-- Save status indicator (brief toast on the card) -->
	{#if saving}
		<div class="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
			<div class="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
		</div>
	{/if}
	{#if saveStatus === 'success'}
		<div class="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
			<svg class="h-10 w-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path d="M5 13l4 4L19 7" />
			</svg>
		</div>
	{/if}
	{#if saveStatus === 'error'}
		<div class="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
			<svg class="h-10 w-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path d="M6 18 18 6M6 6l12 12" />
			</svg>
		</div>
	{/if}
</div>

<!-- Long-press context menu (bottom sheet) -->
{#if showMenu}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
		onclick={closeMenu}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="w-full max-w-lg rounded-t-2xl bg-surface-container p-4 pb-8"
			onclick={(e) => e.stopPropagation()}
		>
			{#if pin.title || pin.description}
				<p class="mb-3 text-center text-sm text-on-surface-dim line-clamp-1">
					{pin.title || pin.description}
				</p>
			{/if}

			<button
				onclick={handleSaveImage}
				class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-surface-container-high active:bg-surface-container-high"
			>
				<svg class="h-5 w-5 text-on-surface-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
				</svg>
				<span>Save image</span>
			</button>

			<button
				onclick={handleToggleFavorite}
				class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-surface-container-high active:bg-surface-container-high"
			>
				{#if favorited}
					<svg class="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
						<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
					</svg>
					<span>Remove from favorites</span>
				{:else}
					<svg class="h-5 w-5 text-on-surface-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
					</svg>
					<span>Add to favorites</span>
				{/if}
			</button>

			<button
				onclick={closeMenu}
				class="mt-2 w-full rounded-xl px-4 py-3 text-center text-on-surface-dim hover:bg-surface-container-high active:bg-surface-container-high"
			>
				Cancel
			</button>
		</div>
	</div>
{/if}
