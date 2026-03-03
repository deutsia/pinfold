import type { Pin, PinImages, Board, Pinner, SearchResult, UserProfile } from './types.ts';
import { proxyImageUrl } from './image-proxy.ts';

/**
 * Extract a fallback image URL from video pins, story pins, or carousel data.
 */
function extractFallbackImageUrl(raw: Record<string, unknown>): string | undefined {
	// Video pins store thumbnails in videos.video_list
	const videos = raw.videos as Record<string, Record<string, unknown>> | undefined;
	if (videos?.video_list) {
		const videoList = videos.video_list as Record<string, Record<string, unknown>>;
		for (const key of Object.keys(videoList)) {
			if (videoList[key]?.thumbnail) return videoList[key].thumbnail as string;
		}
	}

	// Story/Idea pins have cover images in story_pin_data.pages
	const storyPinData = raw.story_pin_data as Record<string, unknown> | undefined;
	if (storyPinData) {
		const pages = storyPinData.pages as Record<string, unknown>[] | undefined;
		if (pages?.[0]) {
			const pageImage = pages[0].image as Record<string, Record<string, unknown>> | undefined;
			const origUrl = pageImage?.orig?.url as string | undefined;
			const largeUrl = pageImage?.['736x']?.url as string | undefined;
			if (origUrl || largeUrl) return origUrl || largeUrl;
		}
	}

	// Carousel pins have carousel_data.carousel_slots
	const carouselData = raw.carousel_data as Record<string, unknown> | undefined;
	if (carouselData) {
		const slots = carouselData.carousel_slots as Record<string, unknown>[] | undefined;
		if (slots?.[0]) {
			const slotImages = slots[0].images as Record<string, Record<string, unknown>> | undefined;
			if (slotImages?.orig?.url) return slotImages.orig.url as string;
			if (slotImages?.['736x']?.url) return slotImages['736x'].url as string;
		}
	}

	return undefined;
}

/**
 * Extract all carousel slot images from a carousel pin.
 * Returns an array of PinImages, one per slot.
 */
function extractCarouselImages(raw: Record<string, unknown>): PinImages[] {
	const carouselData = raw.carousel_data as Record<string, unknown> | undefined;
	if (!carouselData) return [];

	const slots = carouselData.carousel_slots as Record<string, unknown>[] | undefined;
	if (!Array.isArray(slots) || slots.length <= 1) return [];

	const result: PinImages[] = [];
	for (const slot of slots) {
		const slotImages = slot.images as Record<string, Record<string, unknown>> | undefined;
		if (!slotImages) continue;

		const orig = (slotImages.orig?.url as string) || '';
		const large = (slotImages['736x']?.url as string) || '';
		const thumb = (slotImages['236x']?.url as string) || '';
		const bestOrig = orig || large || thumb;
		if (!bestOrig) continue;

		result.push({
			original: proxyImageUrl(orig || large || thumb),
			'736x': proxyImageUrl(large || orig || thumb),
			'236x': proxyImageUrl(thumb || large || orig)
		});
	}

	return result;
}

/**
 * Parse a pin object from Pinterest's API response.
 * Handles standard pins, video pins, story pins, and carousel pins.
 */
export function parsePin(raw: Record<string, unknown>): Pin | null {
	if (!raw || typeof raw !== 'object') return null;
	if (!raw.id) return null;

	const images = raw.images as Record<string, Record<string, unknown>> | undefined;
	const pinner = raw.pinner as Record<string, unknown> | undefined;
	const board = raw.board as Record<string, unknown> | undefined;

	let origUrl = images?.orig?.url as string | undefined;
	let largeUrl = images?.['736x']?.url as string | undefined;
	let thumbUrl = images?.['236x']?.url as string | undefined;

	// Try fallback sources for pins without standard images
	if (!origUrl && !largeUrl && !thumbUrl) {
		const fallback = extractFallbackImageUrl(raw);
		if (fallback) {
			origUrl = fallback;
			largeUrl = fallback;
			thumbUrl = fallback;
		}
	}

	// Skip items that truly have no images (e.g. ads or module items)
	if (!origUrl && !largeUrl && !thumbUrl) return null;

	const imgOriginal = origUrl || largeUrl || thumbUrl || '';
	const img736 = largeUrl || origUrl || thumbUrl || '';
	const img236 = thumbUrl || largeUrl || origUrl || '';

	return {
		id: String(raw.id),
		description: (raw.description as string) || '',
		title: (raw.title as string) || (raw.grid_title as string) || '',
		images: {
			original: proxyImageUrl(imgOriginal),
			'736x': proxyImageUrl(img736),
			'236x': proxyImageUrl(img236)
		},
		carouselImages: extractCarouselImages(raw),
		link: (raw.link as string) || null,
		boardId: board?.id ? String(board.id) : '',
		boardName: (board?.name as string) || '',
		boardUrl: (board?.url as string) || '',
		pinner: {
			username: (pinner?.username as string) || '',
			fullName: (pinner?.full_name as string) || '',
			avatarUrl: proxyImageUrl((pinner?.image_small_url as string) || '')
		},
		dominantColor: (raw.dominant_color as string) || '#1a1a2e',
		createdAt: (raw.created_at as string) || null
	};
}

/**
 * Parse search results from Pinterest's BaseSearchResource response.
 */
export function parseSearchResponse(data: unknown): SearchResult {
	const result: SearchResult = { pins: [], bookmark: null };

	if (!data || typeof data !== 'object') {
		throw new Error('Expected JSON response but got ' + typeof data);
	}

	const response = data as Record<string, unknown>;
	const resourceResponse = response.resource_response as Record<string, unknown> | undefined;
	if (!resourceResponse) {
		throw new Error('Missing resource_response in API data');
	}

	const status = resourceResponse.status as string | undefined;
	if (status === 'failure') {
		const message = (resourceResponse.message as string) || 'Pinterest API error';
		throw new Error(message);
	}

	// Extract bookmark for pagination
	result.bookmark = (resourceResponse.bookmark as string) || null;
	// Pinterest returns "-end-" when there are no more results
	if (result.bookmark === '-end-') result.bookmark = null;

	const responseData = resourceResponse.data as Record<string, unknown> | undefined;
	if (!responseData) return result;

	// Handle both direct array (RelatedPinFeedResource) and results object (BaseSearchResource)
	let items: Record<string, unknown>[];
	if (Array.isArray(responseData)) {
		items = responseData;
	} else {
		const results = responseData.results as Record<string, unknown>[] | undefined;
		if (!Array.isArray(results)) return result;
		items = results;
	}

	for (const item of items) {
		// Skip non-pin items (ads, modules, etc.)
		if (item.type && item.type !== 'pin') continue;

		const pin = parsePin(item);
		if (pin) {
			result.pins.push(pin);
		}
	}

	return result;
}

/**
 * Parse a single pin detail response from PinResource.
 */
export function parsePinResponse(data: unknown): Pin | null {
	if (!data || typeof data !== 'object') return null;

	const response = data as Record<string, unknown>;
	const resourceResponse = response.resource_response as Record<string, unknown> | undefined;
	if (!resourceResponse) return null;

	const pinData = resourceResponse.data as Record<string, unknown> | undefined;
	if (!pinData) return null;

	return parsePin(pinData);
}

/**
 * Parse board feed response from BoardFeedResource.
 */
export function parseBoardFeedResponse(data: unknown): { pins: Pin[]; bookmark: string | null } {
	const result = { pins: [] as Pin[], bookmark: null as string | null };

	if (!data || typeof data !== 'object') {
		throw new Error('Expected JSON response but got ' + typeof data);
	}

	const response = data as Record<string, unknown>;
	const resourceResponse = response.resource_response as Record<string, unknown> | undefined;
	if (!resourceResponse) {
		throw new Error('Missing resource_response in API data');
	}

	// Check for Pinterest API error responses
	const status = resourceResponse.status as string | undefined;
	if (status === 'failure') {
		const message = (resourceResponse.message as string) || 'Pinterest API error';
		throw new Error(message);
	}

	result.bookmark = (resourceResponse.bookmark as string) || null;
	if (result.bookmark === '-end-') result.bookmark = null;

	const rawData = resourceResponse.data;
	let items: Record<string, unknown>[];

	if (Array.isArray(rawData)) {
		items = rawData;
	} else if (rawData && typeof rawData === 'object') {
		// Some endpoints wrap pins in data.results
		const results = (rawData as Record<string, unknown>).results;
		if (Array.isArray(results)) {
			items = results;
		} else {
			return result;
		}
	} else {
		return result;
	}

	for (const item of items) {
		if (item.type && item.type !== 'pin') continue;
		const pin = parsePin(item);
		if (pin) result.pins.push(pin);
	}

	return result;
}

/**
 * Parse a single board object from Pinterest's API response.
 */
function parseBoard(raw: Record<string, unknown>): Board | null {
	if (!raw?.id || !raw?.name) return null;

	const coverImages = raw.cover_images as Record<string, Record<string, unknown>> | undefined;
	const imageUrl =
		(coverImages?.['736x']?.url as string) ||
		(coverImages?.orig?.url as string) ||
		(coverImages?.['236x']?.url as string) ||
		null;

	const rawOwner = raw.owner as Record<string, unknown> | undefined;
	const owner: Pinner = {
		username: (rawOwner?.username as string) || '',
		fullName: (rawOwner?.full_name as string) || '',
		avatarUrl: proxyImageUrl((rawOwner?.image_small_url as string) || '')
	};

	return {
		id: String(raw.id),
		name: (raw.name as string) || '',
		description: (raw.description as string) || '',
		url: (raw.url as string) || '',
		pinCount: (raw.pin_count as number) || 0,
		imageUrl: imageUrl ? proxyImageUrl(imageUrl) : null,
		owner
	};
}

/**
 * Parse user boards from ProfileBoardsResource response.
 */
export function parseUserBoards(data: unknown): { boards: Board[]; bookmark: string | null } {
	const result = { boards: [] as Board[], bookmark: null as string | null };

	if (!data || typeof data !== 'object') return result;

	const response = data as Record<string, unknown>;
	const resourceResponse = response.resource_response as Record<string, unknown> | undefined;
	if (!resourceResponse) return result;

	result.bookmark = (resourceResponse.bookmark as string) || null;
	if (result.bookmark === '-end-') result.bookmark = null;

	const boards = resourceResponse.data as Record<string, unknown>[] | undefined;
	if (!Array.isArray(boards)) return result;

	for (const raw of boards) {
		const board = parseBoard(raw);
		if (board) result.boards.push(board);
	}

	return result;
}

/**
 * Parse user profile from UserResource response.
 */
export function parseUserProfile(data: unknown): UserProfile | null {
	if (!data || typeof data !== 'object') return null;

	const response = data as Record<string, unknown>;
	const resourceResponse = response.resource_response as Record<string, unknown> | undefined;
	if (!resourceResponse) return null;

	const userData = resourceResponse.data as Record<string, unknown> | undefined;
	if (!userData) return null;

	return {
		username: (userData.username as string) || '',
		fullName: (userData.full_name as string) || '',
		avatarUrl: proxyImageUrl((userData.image_xlarge_url as string) || ''),
		bio: (userData.about as string) || '',
		followerCount: (userData.follower_count as number) || 0,
		pinCount: (userData.pin_count as number) || 0,
		boardCount: (userData.board_count as number) || 0
	};
}
