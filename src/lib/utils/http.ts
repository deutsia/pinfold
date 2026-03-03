import { CapacitorHttp } from '@capacitor/core';
import { getSettings } from '$lib/stores/settings.svelte';
import { PrivacyHttp } from './privacy-http';

export interface HttpResponse {
	data: unknown;
	status: number;
	headers: Record<string, string>;
}

/**
 * Throw if the HTTP status indicates an error.
 * Capacitor HTTP does not throw on 4xx/5xx, so callers must check manually.
 */
function assertOkStatus(status: number, url: string): void {
	if (status >= 400) {
		throw new Error(`HTTP ${status} from ${new URL(url).pathname}`);
	}
}

/**
 * Pinterest-style headers to mimic a browser request.
 */
function getPinterestHeaders(): Record<string, string> {
	return {
		'User-Agent':
			'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
		Accept: 'application/json, text/javascript, */*; q=0.01',
		'Accept-Language': 'en-US,en;q=0.5',
		'X-Requested-With': 'XMLHttpRequest',
		'X-Pinterest-AppState': 'active',
		'X-Pinterest-PWS-Handler': 'www/search/[scope].js',
		Referer: 'https://www.pinterest.com/'
	};
}

/**
 * Returns true for .b32.i2p addresses (I2P eepsites).
 * Matches on the URL hostname only to avoid false positives from
 * query parameters or path segments that contain these strings.
 */
function isI2P(url: string): boolean {
	try {
		return new URL(url).hostname.endsWith('.b32.i2p');
	} catch {
		return false;
	}
}

/**
 * Returns true for .onion addresses (Tor hidden services).
 * Matches on the URL hostname only to avoid false positives from
 * query parameters or path segments that contain these strings.
 */
function isTor(url: string): boolean {
	try {
		return new URL(url).hostname.endsWith('.onion');
	} catch {
		return false;
	}
}

/**
 * Validates that a proxy response looks like JSON and not an HTML error page.
 * Proxy instances return JSON from api.php; if we hit a wrong endpoint
 * or the instance is down, we may receive an HTML page which would silently
 * produce "No results found" in the UI.
 */
function assertJsonResponse(data: unknown, proxyUrl: string): void {
	if (typeof data === 'string' && data.trimStart().startsWith('<')) {
		throw new Error(
			`Proxy instance returned HTML instead of JSON. ` +
				`The instance at ${proxyUrl} may be down or misconfigured.`
		);
	}
}

/**
 * Make an HTTP GET request.
 *
 * - .b32.i2p and .onion URLs are routed through the native PrivacyHttp plugin
 *   which uses OkHttp with the appropriate local proxy (I2P HTTP proxy at
 *   localhost:4444 or Tor SOCKS5 at localhost:9050) — bypassing Android system DNS.
 * - All other URLs use Capacitor's native HTTP layer, bypassing the WebView's
 *   network stack to avoid CORS issues.
 */
export async function httpGet(
	url: string,
	options: { headers?: Record<string, string>; skipProxy?: boolean } = {}
): Promise<HttpResponse> {
	const settings = getSettings();

	const headers: Record<string, string> = {
		...getPinterestHeaders(),
		...options.headers
	};

	let requestUrl = url;
	const useProxy = settings.proxyUrl && !options.skipProxy;
	if (useProxy) {
		const proxyBase = settings.proxyUrl.replace(/\/$/, '');
		requestUrl = `${proxyBase}/?url=${encodeURIComponent(url)}`;
	}

	// I2P and Tor require the native plugin to route through local proxies.
	if (isI2P(requestUrl) || isTor(requestUrl)) {
		const response = await PrivacyHttp.request({ url: requestUrl, method: 'GET', headers });
		assertOkStatus(response.status, requestUrl);
		return { data: response.data, status: response.status, headers: response.headers };
	}

	const response = await CapacitorHttp.get({
		url: requestUrl,
		headers,
		connectTimeout: 15000,
		readTimeout: 15000
	});

	if (useProxy) {
		assertJsonResponse(response.data, settings.proxyUrl);
	}

	assertOkStatus(response.status, requestUrl);
	return { data: response.data, status: response.status, headers: response.headers };
}

/**
 * Make an HTTP POST request.
 *
 * - .b32.i2p and .onion URLs are routed through the native PrivacyHttp plugin.
 * - All other URLs use Capacitor's native HTTP layer.
 */
export async function httpPost(
	url: string,
	body: string,
	options: { headers?: Record<string, string> } = {}
): Promise<HttpResponse> {
	const settings = getSettings();

	const headers: Record<string, string> = {
		...getPinterestHeaders(),
		'Content-Type': 'application/x-www-form-urlencoded',
		...options.headers
	};

	let requestUrl = url;
	if (settings.proxyUrl) {
		const proxyBase = settings.proxyUrl.replace(/\/$/, '');
		requestUrl = `${proxyBase}/?url=${encodeURIComponent(url)}`;
	}

	// I2P and Tor require the native plugin to route through local proxies.
	if (isI2P(requestUrl) || isTor(requestUrl)) {
		const response = await PrivacyHttp.request({
			url: requestUrl,
			method: 'POST',
			headers,
			data: body
		});
		return { data: response.data, status: response.status, headers: response.headers };
	}

	const response = await CapacitorHttp.post({
		url: requestUrl,
		headers,
		data: body,
		connectTimeout: 15000,
		readTimeout: 15000
	});

	if (settings.proxyUrl) {
		assertJsonResponse(response.data, settings.proxyUrl);
	}

	assertOkStatus(response.status, requestUrl);
	return { data: response.data, status: response.status, headers: response.headers };
}
