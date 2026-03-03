<script lang="ts">
	import '../app.css';
	import NavBar from '$lib/components/NavBar.svelte';
	import { loadSettings, getSettings } from '$lib/stores/settings.svelte.ts';
	import { registerPlugin } from '@capacitor/core';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	loadSettings();

	const settings = getSettings();
	let proxyBannerDismissed = $state(false);

	// Use registerPlugin from @capacitor/core (already a dependency) instead of
	// importing @capacitor/app which Rollup can't resolve during SSR builds
	const CapApp = registerPlugin<{ addListener(event: string, cb: (data: { url: string }) => void): void }>('App');

	onMount(() => {
		// Handle deep links: pinfold://import/PASTE_KEY
		CapApp.addListener('appUrlOpen', (event) => {
			try {
				const url = new URL(event.url);
				if (url.host === 'import' && url.pathname.length > 1) {
					const pasteKey = url.pathname.slice(1);
					goto(`/collages/shared?paste=${encodeURIComponent(pasteKey)}&auto=1`);
				}
			} catch {
				// Invalid URL — ignore
			}
		});
	});
</script>

<div class="flex h-full flex-col bg-surface">
	<!-- Main content area with bottom padding for nav bar -->
	<main class="safe-top flex-1 overflow-y-auto pb-20">
		{#if settings.proxyUrl && !proxyBannerDismissed}
			<div class="mx-4 mt-3 flex items-start gap-3 rounded-2xl bg-surface-container p-3 text-sm">
				<svg
					class="mt-0.5 h-4 w-4 shrink-0 text-primary"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10" />
					<path d="M12 16v-4M12 8h.01" />
				</svg>
				<p class="flex-1 text-on-surface-dim">
					Proxy mode: only search works. For boards, profiles &amp; pin details, use a VPN or
					system proxy instead.
				</p>
				<button
					onclick={() => (proxyBannerDismissed = true)}
					class="shrink-0 text-on-surface-dim hover:text-on-surface"
					aria-label="Dismiss"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</div>
		{/if}
		{@render children()}
	</main>

	<NavBar />
</div>
