<script lang="ts">
	/**
	 * Image component that loads images via Capacitor's native HTTP layer.
	 * The WebView's <img> tags load from https://localhost origin, which
	 * Pinterest's CDN may reject. Using CapacitorHttp.get() routes the
	 * request through Android's native OkHttp, bypassing WebView restrictions.
	 *
	 * For .b32.i2p and .onion URLs, requests are routed through the PrivacyHttp
	 * plugin which uses the local I2P/Tor proxy for DNS resolution.
	 */
	import { CapacitorHttp } from '@capacitor/core';
	import { PrivacyHttp } from '$lib/utils/privacy-http';

	interface Props {
		src: string;
		alt?: string;
		class?: string;
		onload?: () => void;
		onerror?: () => void;
	}

	let { src, alt = '', class: className = '', onload, onerror }: Props = $props();

	let dataUrl = $state('');

	const BROWSER_HEADERS = {
		'User-Agent':
			'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
		Referer: 'https://www.pinterest.com/'
	};

	function needsPrivacyProxy(url: string): boolean {
		return url.includes('.b32.i2p') || url.includes('.onion');
	}

	$effect(() => {
		const url = src;
		if (!url) {
			onerror?.();
			return;
		}

		dataUrl = '';
		let cancelled = false;

		const fetchPromise = needsPrivacyProxy(url)
			? PrivacyHttp.request({
					url,
					method: 'GET',
					headers: BROWSER_HEADERS,
					responseType: 'blob'
				}).then((response) => {
					const contentType =
						response.headers['content-type'] ||
						response.headers['Content-Type'] ||
						'image/jpeg';
					return { base64: response.data as string, contentType };
				})
			: CapacitorHttp.get({
					url,
					headers: BROWSER_HEADERS,
					responseType: 'blob'
				}).then((response) => {
					const contentType =
						response.headers['content-type'] ||
						response.headers['Content-Type'] ||
						'image/jpeg';
					return { base64: response.data as string, contentType };
				});

		fetchPromise
			.then(({ base64, contentType }) => {
				if (cancelled) return;
				dataUrl = `data:${contentType};base64,${base64}`;
				onload?.();
			})
			.catch(() => {
				if (!cancelled) onerror?.();
			});

		return () => {
			cancelled = true;
		};
	});
</script>

{#if dataUrl}
	<img src={dataUrl} {alt} class={className} />
{/if}
