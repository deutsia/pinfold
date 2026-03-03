import { httpGet } from '$lib/utils/http.ts';
import {
	parseSearchResponse,
	parsePinResponse,
	parseBoardFeedResponse,
	parseUserProfile,
	parseUserBoards
} from './parser.ts';
import { parseBinternetSearchHtml } from './proxy-html-parser.ts';
import { getSettings } from '$lib/stores/settings.svelte';
import type { SearchResult, Pin, UserProfile, Board } from './types.ts';

const BASE_URL = 'https://www.pinterest.com';

/**
 * Build the data parameter for Pinterest's internal API.
 */
function buildDataParam(options: Record<string, unknown>): string {
	return JSON.stringify({
		options,
		context: {}
	});
}

/**
 * Search for pins using Pinterest's internal BaseSearchResource.
 *
 * When a Binternet proxy is configured, calls the instance's search.php
 * directly and parses the HTML response — Binternet is a web frontend,
 * not a generic URL proxy, so /?url=... does not work.
 */
export async function searchPins(query: string, bookmark?: string): Promise<SearchResult> {
	const settings = getSettings();

	if (settings.proxyUrl) {
		const proxyBase = settings.proxyUrl.replace(/\/$/, '');
		const params = new URLSearchParams({ q: query });
		if (bookmark) {
			// Bookmark may contain an embedded csrftoken (separated by \0)
			// needed by the Binternet proxy for paginated requests.
			const [bm, csrftoken] = bookmark.split('\0');
			params.set('bookmark', bm);
			if (csrftoken) params.set('csrftoken', csrftoken);
		}
		const url = `${proxyBase}/search.php?${params}`;
		const response = await httpGet(url, { skipProxy: true });
		const result = parseBinternetSearchHtml(response.data as string);
		console.log(`[Search] proxy search: ${result.pins.length} pins, bookmark=${result.bookmark ? 'yes' : 'no'}, data type=${typeof response.data}, data length=${typeof response.data === 'string' ? response.data.length : 'N/A'}`);
		return result;
	}

	const options: Record<string, unknown> = {
		query,
		bookmarks: bookmark ? [bookmark] : [''],
		field_set_key: 'unauth_react',
		no_fetch_context_on_resource: false
	};

	const params = new URLSearchParams({
		source_url: `/search/pins/?q=${encodeURIComponent(query)}`,
		data: buildDataParam(options)
	});

	const apiUrl = `${BASE_URL}/resource/BaseSearchResource/get/?${params}`;
	const response = await httpGet(apiUrl);

	return parseSearchResponse(response.data);
}

/**
 * Get a single pin's details.
 */
export async function getPin(pinId: string): Promise<Pin | null> {
	const options = {
		id: pinId,
		field_set_key: 'detailed',
		no_fetch_context_on_resource: false
	};

	const params = new URLSearchParams({
		source_url: `/pin/${pinId}/`,
		data: buildDataParam(options)
	});

	const url = `${BASE_URL}/resource/PinResource/get/?${params}`;
	const response = await httpGet(url, {
		headers: {
			'X-Pinterest-PWS-Handler': 'www/pin/[id].js',
			Referer: `${BASE_URL}/pin/${pinId}/`
		}
	});

	return parsePinResponse(response.data);
}

/**
 * Get pins related to a specific pin.
 */
export async function getRelatedPins(
	pinId: string,
	bookmark?: string
): Promise<SearchResult> {
	const options: Record<string, unknown> = {
		pin: pinId,
		add_vase: true,
		bookmarks: bookmark ? [bookmark] : [''],
		field_set_key: 'unauth_react'
	};

	const params = new URLSearchParams({
		source_url: `/pin/${pinId}/`,
		data: buildDataParam(options)
	});

	const url = `${BASE_URL}/resource/RelatedPinFeedResource/get/?${params}`;
	const response = await httpGet(url, {
		headers: {
			'X-Pinterest-PWS-Handler': 'www/pin/[id].js',
			Referer: `${BASE_URL}/pin/${pinId}/`
		}
	});

	return parseSearchResponse(response.data);
}

/**
 * Resolve a board's numeric ID from its slug (e.g. "username/board-name").
 *
 * Fetches the owner's board list and finds the matching board by URL.
 */
async function resolveBoardId(boardSlug: string): Promise<string> {
	const slug = boardSlug.replace(/^\/+|\/+$/g, '');
	const parts = slug.split('/');
	if (parts.length < 2) throw new Error(`Invalid board slug: ${boardSlug}`);

	const username = parts[0];
	const boardUrl = `/${slug}/`;

	const { boards } = await getUserBoards(username);
	const match = boards.find((b) => b.url === boardUrl);
	if (!match) throw new Error(`Board not found: ${boardSlug}`);

	return match.id;
}

/**
 * Get pins from a board.
 *
 * boardSlug is the path portion from the board URL (e.g. "username/board-name").
 * boardId is the numeric Pinterest board ID. If not provided it will be resolved
 * from the slug via an extra API call.
 */
export async function getBoardPins(
	boardSlug: string,
	bookmark?: string,
	boardId?: string
): Promise<{ pins: Pin[]; bookmark: string | null }> {
	const slug = boardSlug.replace(/^\/+|\/+$/g, '');
	const boardUrl = `/${slug}/`;
	const username = slug.split('/')[0] || '';

	const id = boardId || (await resolveBoardId(slug));

	const options: Record<string, unknown> = {
		isPrefetch: false,
		board_id: id,
		field_set_key: 'partner_react_grid_pin',
		filter_section_pins: true,
		layout: 'default',
		page_size: 25,
		redux_normalize_feed: true,
		bookmarks: bookmark ? [bookmark] : ['']
	};

	const params = new URLSearchParams({
		source_url: boardUrl,
		data: buildDataParam(options)
	});

	const url = `${BASE_URL}/resource/BoardFeedResource/get/?${params}`;
	const response = await httpGet(url, {
		headers: {
			'X-Pinterest-PWS-Handler': `www/${username}.js`,
			Referer: `${BASE_URL}${boardUrl}`
		}
	});

	const result = parseBoardFeedResponse(response.data);
	console.log(`[Board] ${boardUrl} (id=${id}): ${result.pins.length} pins, bookmark=${result.bookmark ? 'yes' : 'no'}`);
	return result;
}

/**
 * Get a user's boards.
 */
export async function getUserBoards(
	username: string,
	bookmark?: string
): Promise<{ boards: Board[]; bookmark: string | null }> {
	const options: Record<string, unknown> = {
		username,
		field_set_key: 'grid_item',
		no_fetch_context_on_resource: false
	};

	if (bookmark) {
		options.bookmarks = [bookmark];
	}

	const params = new URLSearchParams({
		source_url: `/${username}/boards/`,
		data: buildDataParam(options)
	});

	const apiUrl = `${BASE_URL}/resource/ProfileBoardsResource/get/?${params}`;
	const response = await httpGet(apiUrl, {
		headers: {
			'X-Pinterest-PWS-Handler': 'www/[username]/[slug].js',
			Referer: `${BASE_URL}/${username}/`
		}
	});

	return parseUserBoards(response.data);
}

/**
 * Get a user's pins.
 */
export async function getUserPins(
	username: string,
	bookmark?: string
): Promise<{ pins: Pin[]; bookmark: string | null }> {
	const options: Record<string, unknown> = {
		username,
		bookmarks: bookmark ? [bookmark] : [''],
		field_set_key: 'unauth_react'
	};

	const params = new URLSearchParams({
		source_url: `/${username}/pins/`,
		data: buildDataParam(options)
	});

	const url = `${BASE_URL}/resource/UserPinsResource/get/?${params}`;
	const response = await httpGet(url, {
		headers: {
			'X-Pinterest-PWS-Handler': 'www/[username]/[slug].js',
			Referer: `${BASE_URL}/${username}/pins/`
		}
	});

	return parseBoardFeedResponse(response.data);
}

/**
 * Get a user's profile information.
 */
export async function getUserProfile(username: string): Promise<UserProfile | null> {
	const options = {
		username,
		field_set_key: 'profile'
	};

	const params = new URLSearchParams({
		source_url: `/${username}/`,
		data: buildDataParam(options)
	});

	const url = `${BASE_URL}/resource/UserResource/get/?${params}`;
	const response = await httpGet(url, {
		headers: {
			'X-Pinterest-PWS-Handler': 'www/[username]/[slug].js',
			Referer: `${BASE_URL}/${username}/`
		}
	});

	return parseUserProfile(response.data);
}
