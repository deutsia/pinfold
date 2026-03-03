import { CapacitorHttp } from '@capacitor/core';
import { PrivacyHttp } from './privacy-http';
import { selectImageSize } from '$lib/api/image-proxy';
import type { Pin, PinImages } from '$lib/api/types';

const DL_HEADERS = {
	'User-Agent':
		'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
	Referer: 'https://www.pinterest.com/'
};

/**
 * Download an image and save it directly to the device's Downloads folder.
 * Uses a native MediaStore API call on Android 10+ for reliable access
 * to the public Downloads directory.
 */
export async function downloadPinImage(
	pin: Pin,
	carouselIndex?: number
): Promise<void> {
	const isCarousel = pin.carouselImages.length > 1;
	let images: PinImages;
	if (isCarousel && carouselIndex !== undefined) {
		images = pin.carouselImages[carouselIndex];
	} else {
		images = pin.images;
	}

	const imageUrl = selectImageSize(images, 'full');
	const needsProxy = imageUrl.includes('.b32.i2p') || imageUrl.includes('.onion');

	const response = needsProxy
		? await PrivacyHttp.request({
				url: imageUrl,
				method: 'GET',
				headers: DL_HEADERS,
				responseType: 'blob'
			})
		: await CapacitorHttp.get({
				url: imageUrl,
				headers: DL_HEADERS,
				responseType: 'blob'
			});

	const ext = imageUrl.includes('.png') ? 'png' : 'jpg';
	const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
	const suffix = isCarousel && carouselIndex !== undefined ? `_${carouselIndex + 1}` : '';
	// Sanitize pin ID to prevent path traversal in filename
	const safeId = pin.id.replace(/[^a-zA-Z0-9_-]/g, '_');
	const fileName = `pinfold_${safeId}${suffix}.${ext}`;

	// Save directly to Downloads folder via native MediaStore API
	await PrivacyHttp.saveToDownloads({
		data: response.data as string,
		fileName,
		mimeType
	});
}
