import { getSettings } from '$lib/stores/settings.svelte';

const ALLOWED_DOMAINS = ['i.pinimg.com', 'pinimg.com', 'pinterest.com', 's.pinimg.com'];

// Instances that serve images by path (proxy.host/i.pinimg.com/originals/...)
// instead of via image_proxy.php?url=
const PATH_BASED_IMAGE_HOSTS = [
	'proxyrr4qmb46amdiufytunrs6joupqzedxgakcgddmbwbawjk7a.b32.i2p'
];

/**
 * Check if a URL belongs to an allowed Pinterest image domain.
 */
function isAllowedDomain(url: string): boolean {
	try {
		const hostname = new URL(url).hostname;
		return ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
	} catch {
		return false;
	}
}

/**
 * Check if a proxy uses path-based image routing instead of image_proxy.php.
 */
function usesPathBasedImages(proxyUrl: string): boolean {
	try {
		const hostname = new URL(proxyUrl).hostname;
		return PATH_BASED_IMAGE_HOSTS.includes(hostname);
	} catch {
		return false;
	}
}

/**
 * Rewrite a Pinterest image URL to go through the proxy if configured,
 * or return the original URL for direct loading.
 *
 * When a proxy is configured, images are routed through it for privacy.
 * Without a proxy, the raw URL is returned — components must use
 * FetchImage.svelte to load it via fetch() (routed through native HTTP
 * by CapacitorHttp) so that proper headers are included.
 */
export function proxyImageUrl(url: string): string {
	if (!url) return '';
	if (!isAllowedDomain(url)) return url;

	const settings = getSettings();

	if (settings.proxyUrl) {
		const proxyBase = settings.proxyUrl.replace(/\/$/, '');

		if (usesPathBasedImages(settings.proxyUrl)) {
			// Path-based: proxy.b32.i2p/i.pinimg.com/originals/...
			const strippedUrl = url.replace(/^https?:\/\//, '');
			return `${proxyBase}/${strippedUrl}`;
		}

		return `${proxyBase}/image_proxy.php?url=${encodeURIComponent(url)}`;
	}

	return url;
}

/**
 * Select the best image size based on display context.
 */
export function selectImageSize(
	images: { original: string; '736x': string; '236x': string },
	context: 'grid' | 'detail' | 'full'
): string {
	switch (context) {
		case 'grid':
			return images['236x'] || images['736x'] || images.original;
		case 'detail':
			return images['736x'] || images.original;
		case 'full':
			return images.original || images['736x'];
	}
}
