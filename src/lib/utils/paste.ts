import { CapacitorHttp } from '@capacitor/core';

const PASTE_API = 'https://paste.rs/';

/**
 * Upload text content to paste.rs and return the paste key.
 */
export async function createPaste(content: string): Promise<string> {
	const response = await CapacitorHttp.post({
		url: PASTE_API,
		headers: {
			'Content-Type': 'text/plain',
			'User-Agent': 'Pinfold/1.0'
		},
		data: content,
		connectTimeout: 15000,
		readTimeout: 15000
	});

	if (response.status >= 400) {
		throw new Error(`Paste service returned HTTP ${response.status}`);
	}

	// Response is the paste URL, e.g. "https://paste.rs/XXXXX"
	const responseText = typeof response.data === 'string'
		? response.data
		: String(response.data);

	// Extract the paste key from the URL
	const url = responseText.trim().replace(/\/$/, '');
	const key = url.split('/').pop();
	if (!key) {
		throw new Error('Could not extract paste key from response');
	}

	return key;
}

/**
 * Fetch raw content from paste.rs by its key.
 */
export async function fetchPaste(key: string): Promise<string> {
	const cleanKey = extractPasteKey(key);

	const response = await CapacitorHttp.get({
		url: `${PASTE_API}${cleanKey}`,
		headers: {
			'User-Agent': 'Pinfold/1.0'
		},
		connectTimeout: 15000,
		readTimeout: 15000
	});

	if (response.status >= 400) {
		throw new Error(`Paste not found or expired (HTTP ${response.status})`);
	}

	return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
}

// Paste.rs keys are short alphanumeric identifiers (typically 3–6 chars).
// Restrict to word characters only to prevent URL manipulation via
// characters like '/', '?', '#', '\r', '\n' in the constructed request URL.
const PASTE_KEY_RE = /^[\w-]{1,64}$/;

/**
 * Extract the paste key from a full paste.rs URL or return
 * the input as-is if it's already just a key.
 * Throws if the resulting key contains unsafe characters.
 */
function extractPasteKey(input: string): string {
	const trimmed = input.trim();

	let key = trimmed;
	try {
		const url = new URL(trimmed);
		if (url.hostname === 'paste.rs') {
			const parts = url.pathname.split('/').filter(Boolean);
			if (parts.length > 0) {
				key = parts[0];
			}
		}
	} catch {
		// Not a URL, treat as raw key
	}

	if (!PASTE_KEY_RE.test(key)) {
		throw new Error('Invalid paste key format');
	}

	return key;
}
