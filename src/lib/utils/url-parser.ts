/**
 * Parse a Pinterest URL or username input and return an internal app route.
 * Returns null if the input is not a recognizable Pinterest URL/username.
 */
export function parsePinterestUrl(input: string): string | null {
	const trimmed = input.trim();

	// Try to parse as a URL (pinterest.com/... or pin.it/...)
	const urlMatch = trimmed.match(
		/^(?:https?:\/\/)?(?:www\.)?pinterest\.(?:com|ca|co\.uk|de|fr|es|it|jp|kr|au|at|ch|nl|be|pt|se|no|dk|fi|ie|nz|ph|cl|ar|mx|co|br|ru|pl|cz|hu|ro|bg|hr|sk|si|rs|lt|lv|ee|gr|tr|in|id|my|sg|th|vn|tw|hk|ae|za)\/(.+)/i
	);

	if (urlMatch) {
		const path = urlMatch[1].replace(/\/+$/, '');
		return parsePinterestPath(path);
	}

	return null;
}

function parsePinterestPath(path: string): string | null {
	// /pin/12345/ -> pin detail
	const pinMatch = path.match(/^pin\/(\d+)/);
	if (pinMatch) {
		return `/pin/${pinMatch[1]}`;
	}

	// /username/boardname/ -> board
	// /username/ -> user profile
	const segments = path.split('/').filter(Boolean);

	if (segments.length === 0) return null;

	// Skip known non-user paths
	const reserved = ['search', 'settings', 'ideas', 'today', 'categories', 'topics', '_'];
	if (reserved.includes(segments[0].toLowerCase())) return null;

	if (segments.length === 1) {
		// Single segment = username
		return `/user/${segments[0]}`;
	}

	if (segments.length >= 2 && segments[1] !== 'pins') {
		// Two segments = username/board
		return `/board/${segments[0]}/${segments[1]}`;
	}

	// username/pins -> user profile
	return `/user/${segments[0]}`;
}
