<script lang="ts">
	import { useSettings, THEME_COLORS, PROXY_INSTANCES } from '$lib/stores/settings.svelte.ts';
	import type { ThemeColor, ThemeMode } from '$lib/stores/settings.svelte.ts';

	const settings = useSettings();

	let proxyUrl = $state(settings.current.proxyUrl);
	let themeColor = $state(settings.current.themeColor);
	let themeMode = $state(settings.current.theme);
	let showInstances = $state(false);
	let proxyError = $state<string | null>(null);

	function saveProxy() {
		try {
			settings.update({ proxyUrl: proxyUrl.trim() });
			proxyError = null;
		} catch (e) {
			proxyError = e instanceof Error ? e.message : 'Invalid proxy URL';
		}
	}

	function selectInstance(url: string) {
		proxyUrl = url;
		try {
			settings.update({ proxyUrl: url });
			proxyError = null;
		} catch (e) {
			proxyError = e instanceof Error ? e.message : 'Invalid proxy URL';
		}
		showInstances = false;
	}

	function clearProxy() {
		proxyUrl = '';
		settings.update({ proxyUrl: '' });
	}

	function handleThemeColor(color: ThemeColor) {
		themeColor = color;
		settings.update({ themeColor: color });
	}

	function handleThemeMode(mode: ThemeMode) {
		themeMode = mode;
		settings.update({ theme: mode });
	}

	function handleReset() {
		settings.reset();
		proxyUrl = '';
		themeColor = 'rose';
		themeMode = 'dark';
		showInstances = false;
	}

	const FLAGS: Record<string, string> = {
		FI: '\u{1F1EB}\u{1F1EE}',
		DE: '\u{1F1E9}\u{1F1EA}',
		SG: '\u{1F1F8}\u{1F1EC}',
		NL: '\u{1F1F3}\u{1F1F1}'
	};
</script>

<svelte:head>
	<title>Settings - Pinfold</title>
</svelte:head>

<div class="px-4 py-4">
	<h1 class="mb-6 text-2xl font-bold">Settings</h1>

	<!-- Theme -->
	<section class="mb-8">
		<h2 class="mb-1 text-lg font-semibold">Theme</h2>
		<p class="mb-3 text-sm text-on-surface-dim">
			Choose your color and mode.
		</p>

		<!-- Color picker -->
		<div class="mb-4 flex flex-wrap gap-3">
			{#each THEME_COLORS as color (color.id)}
				<button
					onclick={() => handleThemeColor(color.id)}
					class="group relative flex flex-col items-center gap-1.5"
					title={color.label}
				>
					<div
						class="flex h-12 w-12 items-center justify-center rounded-full transition-all
							{themeColor === color.id ? 'ring-2 ring-on-surface ring-offset-2 ring-offset-surface scale-110' : 'hover:scale-105'}"
						style="background-color: {color.preview}"
					>
						{#if themeColor === color.id}
							<svg class="h-5 w-5 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
								<path d="M5 13l4 4L19 7" />
							</svg>
						{/if}
					</div>
					<span class="text-xs {themeColor === color.id ? 'font-semibold text-on-surface' : 'text-on-surface-dim'}">
						{color.label}
					</span>
				</button>
			{/each}
		</div>

		<!-- Mode toggle -->
		<div class="flex gap-2">
			<button
				onclick={() => handleThemeMode('dark')}
				class="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors
					{themeMode === 'dark'
						? 'bg-primary text-on-primary'
						: 'bg-surface-container-high text-on-surface hover:bg-surface-bright'}"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
				Dark
			</button>
			<button
				onclick={() => handleThemeMode('light')}
				class="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors
					{themeMode === 'light'
						? 'bg-primary text-on-primary'
						: 'bg-surface-container-high text-on-surface hover:bg-surface-bright'}"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="5" />
					<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
				</svg>
				Light
			</button>
		</div>
	</section>

	<!-- Proxy Configuration -->
	<section class="mb-8">
		<h2 class="mb-1 text-lg font-semibold">Proxy <span class="text-sm font-normal text-on-surface-dim">(experimental)</span></h2>
		<p class="mb-3 text-sm text-on-surface-dim">
			Route requests through a Binternet proxy instance for privacy. Leave empty for direct connections.
		</p>

		<div class="flex gap-2">
			<input
				type="url"
				bind:value={proxyUrl}
				placeholder="https://your-proxy.example.com"
				class="flex-1 rounded-xl bg-surface-container-high px-4 py-3 text-on-surface placeholder:text-on-surface-dim focus:ring-2 focus:ring-primary focus:outline-none"
			/>
			<button
				onclick={saveProxy}
				class="rounded-xl bg-primary px-4 py-3 font-medium text-on-primary"
			>
				Save
			</button>
		</div>

		{#if proxyError}
			<p class="mt-1 text-xs text-error">{proxyError}</p>
		{/if}

		{#if proxyUrl}
			<button
				onclick={clearProxy}
				class="mt-2 text-xs text-on-surface-dim hover:text-on-surface"
			>
				Clear proxy (use direct connection)
			</button>
		{/if}

		<!-- Instance picker toggle -->
		<button
			onclick={() => (showInstances = !showInstances)}
			class="mt-3 flex items-center gap-1.5 text-sm text-primary"
		>
			<svg class="h-4 w-4 transition-transform {showInstances ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path d="m9 18 6-6-6-6" />
			</svg>
			{showInstances ? 'Hide' : 'Choose from'} known instances
		</button>

		{#if showInstances}
			<div class="mt-3 space-y-2">
				{#each PROXY_INSTANCES as instance (instance.name)}
					<div class="rounded-xl bg-surface-container p-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="text-base">{FLAGS[instance.country] || instance.country}</span>
								<span class="text-sm font-medium">{instance.name}</span>
								{#if instance.unofficial}
									<span class="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-medium text-yellow-300">unofficial</span>
								{/if}
							</div>
							<div class="flex items-center gap-1.5">
								{#if instance.tor}
									<span class="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium text-purple-300">TOR</span>
								{/if}
								{#if instance.i2p}
									<span class="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-300">I2P</span>
								{/if}
							</div>
						</div>

						<div class="mt-2 flex flex-wrap gap-1.5">
							{#if instance.clearnet}
								<button
									onclick={() => selectInstance(instance.clearnet ?? '')}
									class="rounded-lg px-2.5 py-1 text-xs transition-colors
										{proxyUrl === instance.clearnet
											? 'bg-primary text-on-primary'
											: 'bg-surface-container-high text-on-surface hover:bg-surface-bright'}"
								>
									Clearnet
								</button>
							{/if}
							{#if instance.tor}
								<button
									onclick={() => selectInstance(instance.tor ?? '')}
									class="rounded-lg px-2.5 py-1 text-xs transition-colors
										{proxyUrl === instance.tor
											? 'bg-primary text-on-primary'
											: 'bg-surface-container-high text-on-surface hover:bg-surface-bright'}"
								>
									Tor (.onion)
								</button>
							{/if}
							{#if instance.i2p}
								<button
									onclick={() => selectInstance(instance.i2p ?? '')}
									class="rounded-lg px-2.5 py-1 text-xs transition-colors
										{proxyUrl === instance.i2p
											? 'bg-primary text-on-primary'
											: 'bg-surface-container-high text-on-surface hover:bg-surface-bright'}"
								>
									I2P (.i2p)
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<p class="mt-3 text-xs text-on-surface-dim">
				Some instances use bot protection (e.g. Anubis) which blocks app requests. If search returns an error, try a different instance.
			</p>
			<p class="mt-1 text-xs text-on-surface-dim">
				Tor requires a local SOCKS5 proxy on port 9050 (e.g. Orbot, InviZible Pro). I2P requires a local HTTP proxy on port 4444 (e.g. I2Pd, InviZible Pro). VPN mode is not required.
			</p>
		{/if}
	</section>

	<!-- About -->
	<section class="mb-8">
		<h2 class="mb-1 text-lg font-semibold">About</h2>
		<div class="rounded-xl bg-surface-container p-4">
			<p class="font-medium">Pinfold for Android</p>
			<p class="mt-1 text-sm text-on-surface-dim">v0.1.0</p>
			<p class="mt-2 text-sm text-on-surface-dim">
				A privacy-respecting Pinterest client. No accounts, no tracking.
			</p>
			<p class="mt-2 text-sm text-on-surface-dim">
				Based on <a href="https://github.com/AhwxOrg/Binternet" target="_blank" class="text-primary hover:underline">Binternet</a> (GPL-3.0).
			</p>
		</div>
	</section>

	<!-- Reset -->
	<section>
		<button
			onclick={handleReset}
			class="rounded-xl bg-surface-container-high px-4 py-3 text-sm text-error hover:bg-surface-bright"
		>
			Reset all settings
		</button>
	</section>
</div>
