import { proxyImageUrl } from './image-proxy.ts';
import type { Pin, SearchResult } from './types.ts';

/**
 * Check whether the HTML response is a bot-protection challenge page
 * (e.g. Anubis) rather than actual Binternet search results.
 *
 * Anubis returns a JavaScript proof-of-work challenge that native HTTP
 * clients cannot solve. We detect it by the absence of Binternet HTML
 * markers combined with bot-protection signatures.
 */
function detectBotProtection(html: string): string | null {
	const lowerHtml = html.toLowerCase();

	// A valid Binternet search page always contains the img-container div,
	// even when there are no results ("No results found." is rendered inside it).
	const isBinternetPage = lowerHtml.includes('img-container') || lowerHtml.includes('img-result');

	if (isBinternetPage) return null;

	// Check for known bot-protection signatures
	if (lowerHtml.includes('anubis')) {
		return 'This instance uses Anubis bot protection which blocks app requests. Please try a different instance (e.g. opnxng.com).';
	}

	if (lowerHtml.includes('checking your browser') || lowerHtml.includes('proof-of-work') || lowerHtml.includes('challenge-platform')) {
		return 'This instance uses bot protection which blocks app requests. Please try a different instance.';
	}

	// Generic fallback: not a Binternet page and not search results
	if (html.length > 0 && html.length < 10000) {
		return 'This instance returned an unexpected page instead of search results. It may be down, misconfigured, or using bot protection. Please try a different instance.';
	}

	return null;
}

/**
 * Parse Binternet's search.php HTML response into a SearchResult.
 *
 * Binternet renders search results as HTML rather than JSON. Different instances
 * use different formats:
 *
 * Format A (proxy): src='/image_proxy.php?url=https://i.pinimg.com/...'
 * Format B (direct): src='i.pinimg.com/originals/...'
 *
 * Both use class=img-result on anchor tags wrapping <img> elements.
 *
 * Only image URLs are available — pin IDs, titles, and metadata are not
 * exposed by Binternet's HTML. Pin IDs are derived from the image filename.
 */
export function parseBinternetSearchHtml(html: string): SearchResult {
	// Detect bot-protection challenge pages before parsing
	const botProtectionError = detectBotProtection(html);
	if (botProtectionError) {
		throw new Error(botProtectionError);
	}

	const result: SearchResult = { pins: [], bookmark: null };

	// Match <img> src attributes containing pinimg.com — works for both
	// proxy-wrapped and direct URL formats.
	const imgRegex = /src=['"]([^'"]*pinimg\.com[^'"]*)['"]/g;
	let match;
	let index = 0;

	while ((match = imgRegex.exec(html)) !== null) {
		let imageUrl = match[1];

		// Strip proxy wrapper if present (Format A)
		const proxyIdx = imageUrl.indexOf('image_proxy.php?url=');
		if (proxyIdx >= 0) {
			imageUrl = imageUrl.substring(proxyIdx + 'image_proxy.php?url='.length);
		}

		// Ensure the URL has a protocol
		if (!imageUrl.startsWith('http')) {
			imageUrl = 'https://' + imageUrl;
		}

		// Derive a stable pseudo-ID from the image filename (e.g. the hash portion).
		const filename = imageUrl.split('/').pop() || '';
		const pseudoId = filename.replace(/\.[^.]+$/, '') || String(index);

		const pin: Pin = {
			id: pseudoId,
			description: '',
			title: '',
			images: {
				original: proxyImageUrl(imageUrl),
				'736x': proxyImageUrl(imageUrl),
				'236x': proxyImageUrl(imageUrl)
			},
			carouselImages: [],
			link: null,
			boardId: '',
			boardName: '',
			boardUrl: '',
			pinner: { username: '', fullName: '', avatarUrl: '' },
			dominantColor: '#1a1a2e',
			createdAt: null
		};

		result.pins.push(pin);
		index++;
	}

	// Extract bookmark and csrftoken from the "Next page" link.
	// Binternet uses: href="/search.php?q=...&bookmark=BOOKMARK&csrftoken=TOKEN"
	// The csrftoken is required for paginated requests — without it the proxy
	// can't authenticate its POST request to Pinterest and returns empty results.
	// We encode both values into the bookmark string (separated by \0) so the
	// csrftoken is available when making subsequent requests.
	const nextLinkMatch = /href=['"][^'"]*search\.php\?([^'"]+)['"]/.exec(html);
	if (nextLinkMatch) {
		const queryString = nextLinkMatch[1].replace(/&amp;/g, '&');
		const linkParams = new URLSearchParams(queryString);
		const bm = linkParams.get('bookmark');
		const csrf = linkParams.get('csrftoken');
		if (bm) {
			result.bookmark = csrf ? `${bm}\0${csrf}` : bm;
		}
	}

	return result;
}
