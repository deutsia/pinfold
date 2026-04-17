<script lang="ts">
	import type { Pin } from '$lib/api/types.ts';
	import { selectImageSize } from '$lib/api/image-proxy.ts';
	import { toggleFavorite, isFavorited } from '$lib/stores/favorites.svelte.ts';
	import { downloadPinImage, copyPinImageToClipboard } from '$lib/utils/download.ts';
	import { longpress } from '$lib/utils/long-press.ts';
	import { Share } from '@capacitor/share';
	import FetchImage from './FetchImage.svelte';
	import ImageViewer from './ImageViewer.svelte';
	import AddToCollageModal from './AddToCollageModal.svelte';

	interface Props {
		pin: Pin;
	}

	let { pin }: Props = $props();

	let showFullImage = $state(false);
	let showCollageModal = $state(false);
	let favorited = $state(isFavorited(pin.id));
	let currentSlide = $state(0);
	let scrollContainer: HTMLDivElement | undefined = $state();
	let downloading = $state(false);
	let downloadStatus = $state<'idle' | 'success' | 'error'>('idle');
	let copyStatus = $state<'idle' | 'copying' | 'success' | 'error'>('idle');

	const detailSrc = $derived(selectImageSize(pin.images, 'detail'));
	const fullSrc = $derived(selectImageSize(pin.images, 'full'));
	const isCarousel = $derived(pin.carouselImages.length > 1);
	const totalSlides = $derived(isCarousel ? pin.carouselImages.length : 1);

	// For the full-screen viewer, show the current carousel slide
	const viewerSrc = $derived(
		isCarousel
			? selectImageSize(pin.carouselImages[currentSlide], 'full')
			: fullSrc
	);

	function handleDetailScroll() {
		if (!scrollContainer) return;
		const scrollLeft = scrollContainer.scrollLeft;
		const slideWidth = scrollContainer.clientWidth;
		currentSlide = Math.round(scrollLeft / slideWidth);
	}

	function handleFavorite() {
		favorited = toggleFavorite(pin);
	}

	async function handleDownload() {
		if (downloading) return;
		downloading = true;
		downloadStatus = 'idle';

		try {
			await downloadPinImage(pin, isCarousel ? currentSlide : undefined);
			downloadStatus = 'success';
			setTimeout(() => { downloadStatus = 'idle'; }, 2000);
		} catch {
			downloadStatus = 'error';
			setTimeout(() => { downloadStatus = 'idle'; }, 2000);
		} finally {
			downloading = false;
		}
	}

	async function handleCopyImage() {
		if (copyStatus === 'copying') return;
		copyStatus = 'copying';
		try {
			await copyPinImageToClipboard(pin, isCarousel ? currentSlide : undefined);
			copyStatus = 'success';
			setTimeout(() => { copyStatus = 'idle'; }, 1800);
		} catch {
			copyStatus = 'error';
			setTimeout(() => { copyStatus = 'idle'; }, 1800);
		}
	}

	async function handleShare() {
		const url = `https://pinterest.com/pin/${pin.id}/`;
		try {
			await Share.share({
				title: pin.title || pin.description || 'Pin',
				url
			});
		} catch {
			// User cancelled share — ignore
		}
	}
</script>

<div class="mx-auto max-w-2xl">
	<!-- Image(s) -->
	{#if isCarousel}
		<div class="relative">
			<div
				bind:this={scrollContainer}
				onscroll={handleDetailScroll}
				class="flex w-full snap-x snap-mandatory overflow-x-auto rounded-2xl"
				style="scrollbar-width: none; -webkit-overflow-scrolling: touch;"
			>
				{#each pin.carouselImages as slideImages, i (i)}
					<button
						class="w-full flex-shrink-0 snap-center cursor-zoom-in"
						onclick={() => { currentSlide = i; showFullImage = true; }}
						use:longpress={{ onLongPress: () => { currentSlide = i; handleCopyImage(); } }}
					>
						<FetchImage
							src={selectImageSize(slideImages, 'detail')}
							alt="{pin.title || pin.description || 'Pin image'} ({i + 1}/{totalSlides})"
							class="w-full"
						/>
					</button>
				{/each}
			</div>

			<!-- Dot indicators -->
			<div class="mt-3 flex justify-center gap-2">
				{#each pin.carouselImages as _, i (i)}
					<div
						class="h-2 rounded-full transition-all duration-200 {currentSlide === i
							? 'w-6 bg-primary'
							: 'w-2 bg-on-surface-dim/40'}"
					></div>
				{/each}
			</div>

			<!-- Counter -->
			<div class="absolute top-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white">
				{currentSlide + 1} / {totalSlides}
			</div>
		</div>
	{:else}
		<button
			class="w-full cursor-zoom-in"
			onclick={() => (showFullImage = true)}
			use:longpress={{ onLongPress: handleCopyImage }}
		>
			<FetchImage
				src={detailSrc}
				alt={pin.title || pin.description || 'Pin image'}
				class="w-full rounded-2xl"
			/>
		</button>
	{/if}

	<!-- Actions -->
	<div class="mt-4 flex items-center gap-3 px-1">
		<button
			onclick={handleFavorite}
			class="rounded-full p-2 transition-colors {favorited ? 'text-red-400' : 'text-on-surface-dim hover:text-on-surface'}"
		>
			<svg class="h-6 w-6" fill={favorited ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
			</svg>
		</button>

		<button
			onclick={() => (showCollageModal = true)}
			class="rounded-full p-2 text-on-surface-dim hover:text-on-surface"
			title="Add to collage"
		>
			<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
				<rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
			</svg>
		</button>

		<button
			onclick={handleShare}
			class="rounded-full p-2 text-on-surface-dim hover:text-on-surface"
		>
			<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
				<path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
			</svg>
		</button>

		<button
			onclick={handleDownload}
			disabled={downloading}
			class="rounded-full p-2 transition-colors {downloadStatus === 'success'
				? 'text-green-400'
				: downloadStatus === 'error'
					? 'text-error'
					: 'text-on-surface-dim hover:text-on-surface'} {downloading ? 'animate-pulse' : ''}"
			title="Download image"
		>
			{#if downloadStatus === 'success'}
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M5 13l4 4L19 7" />
				</svg>
			{:else}
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
				</svg>
			{/if}
		</button>

		{#if pin.link}
			<a
				href={pin.link}
				target="_blank"
				rel="noopener noreferrer"
				class="rounded-full p-2 text-on-surface-dim hover:text-on-surface"
			>
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
				</svg>
			</a>
		{/if}
	</div>

	<!-- Title & Description -->
	{#if pin.title}
		<h1 class="mt-4 px-1 text-xl font-semibold">{pin.title}</h1>
	{/if}
	{#if pin.description}
		<p class="mt-2 px-1 text-on-surface-dim">{pin.description}</p>
	{/if}

	<!-- Pinner info -->
	{#if pin.pinner.username}
		<a
			href="/user/{pin.pinner.username}"
			class="mt-4 flex items-center gap-3 rounded-xl px-1 py-2 transition-colors hover:bg-surface-container"
		>
			{#if pin.pinner.avatarUrl}
				<FetchImage
					src={pin.pinner.avatarUrl}
					alt={pin.pinner.fullName}
					class="h-10 w-10 rounded-full"
				/>
			{:else}
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary font-semibold">
					{pin.pinner.fullName.charAt(0) || pin.pinner.username.charAt(0)}
				</div>
			{/if}
			<div>
				<p class="font-medium">{pin.pinner.fullName || pin.pinner.username}</p>
				<p class="text-sm text-on-surface-dim">@{pin.pinner.username}</p>
			</div>
		</a>
	{/if}

	<!-- Board link -->
	{#if pin.boardName && pin.boardUrl}
		<a
			href="/board{pin.boardUrl}{pin.boardId ? `?id=${pin.boardId}` : ''}"
			class="mt-3 flex items-center gap-2 rounded-xl px-1 py-2 transition-colors hover:bg-surface-container"
		>
			<svg class="h-5 w-5 text-on-surface-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
				<rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
			</svg>
			<span class="text-sm text-on-surface-dim">{pin.boardName}</span>
		</a>
	{/if}
</div>

{#if showFullImage}
	<ImageViewer
		src={viewerSrc}
		alt={pin.title || pin.description}
		onclose={() => (showFullImage = false)}
		onlongpress={handleCopyImage}
	/>
{/if}

{#if showCollageModal}
	<AddToCollageModal {pin} onclose={() => (showCollageModal = false)} />
{/if}

{#if copyStatus !== 'idle'}
	<div class="pointer-events-none fixed inset-x-0 bottom-24 z-[110] flex justify-center px-4">
		<div
			class="rounded-full px-4 py-2 text-sm font-medium shadow-lg {copyStatus === 'success'
				? 'bg-green-500/90 text-white'
				: copyStatus === 'error'
					? 'bg-error text-white'
					: 'bg-surface-container-high text-on-surface'}"
		>
			{#if copyStatus === 'copying'}
				Copying image…
			{:else if copyStatus === 'success'}
				Image copied to clipboard
			{:else}
				Copy failed
			{/if}
		</div>
	</div>
{/if}
