<script lang="ts">
	import { goto } from '$app/navigation';
	import { useSettings, THEME_COLORS, PROXY_INSTANCES } from '$lib/stores/settings.svelte.ts';
	import type { ThemeColor, ThemeMode } from '$lib/stores/settings.svelte.ts';
	import { useFollows } from '$lib/stores/follows.svelte.ts';
	import { useHistory } from '$lib/stores/history.svelte.ts';

	const settings = useSettings();
	const follows = useFollows();
	const history = useHistory();

	let proxyUrl = $state(settings.current.proxyUrl);
	let themeColor = $state(settings.current.themeColor);
	let themeMode = $state(settings.current.theme);
	let showInstances = $state(false);

	function saveProxy() {
		settings.update({ proxyUrl: proxyUrl.trim() });
	}

	function selectInstance(url: string) {
		proxyUrl = url;
		settings.update({ proxyUrl: url });
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

	const MONERO_ADDRESS =
		'82v1E5A3FiiVBeKentTguv83RbaHY6etLW4XTFkuFfzb9fGAetSiY6SeAttUSHqZ3XbnTHU1PzHSmGZn3dMfiBE35UgJMhq';
	let copiedDonate = $state(false);

	async function copyMonero() {
		try {
			await navigator.clipboard.writeText(MONERO_ADDRESS);
			copiedDonate = true;
			setTimeout(() => { copiedDonate = false; }, 2000);
		} catch {
			// Clipboard API unavailable — ignore
		}
	}

	// ===== Subscriptions & data management =====
	let importError = $state<string | null>(null);
	let importStatus = $state<string | null>(null);

	function exportSubscriptions() {
		try {
			const data = follows.exportFollows();
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `pinfold-subscriptions-${new Date().toISOString().slice(0, 10)}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			importStatus = 'Exported';
			setTimeout(() => { importStatus = null; }, 2000);
		} catch {
			importError = 'Failed to export';
			setTimeout(() => { importError = null; }, 3000);
		}
	}

	function triggerImport() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/json,.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			try {
				const text = await file.text();
				const data = JSON.parse(text);
				follows.importFollows(data, 'merge');
				importStatus = `Imported ${(data.users?.length || 0) + (data.topics?.length || 0) + (data.boards?.length || 0)} items`;
				setTimeout(() => { importStatus = null; }, 3000);
			} catch {
				importError = 'Invalid JSON file';
				setTimeout(() => { importError = null; }, 3000);
			}
		};
		input.click();
	}

	function clearSeenHistory() {
		if (confirm('Clear "seen" markers? Pins you opened will no longer appear faded in the feed.')) {
			follows.clearSeen();
		}
	}

	function unhidePinner(username: string) {
		follows.unhidePinner(username);
	}
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

	<!-- Your Data / History -->
	<section class="mb-8">
		<h2 class="mb-1 text-lg font-semibold">Your Data</h2>
		<p class="mb-3 text-sm text-on-surface-dim">Everything below is stored only on this device.</p>

		<div class="flex flex-col gap-2">
			<button
				onclick={() => goto('/history')}
				class="flex items-center justify-between rounded-xl bg-surface-container px-4 py-3 text-left hover:bg-surface-container-high"
			>
				<div class="flex items-center gap-3">
					<svg class="h-5 w-5 text-on-surface-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10" />
						<path d="M12 6v6l4 2" />
					</svg>
					<div>
						<p class="text-sm font-medium">View history</p>
						<p class="text-xs text-on-surface-dim">{history.count} pin{history.count === 1 ? '' : 's'}</p>
					</div>
				</div>
				<svg class="h-4 w-4 text-on-surface-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="m9 18 6-6-6-6" />
				</svg>
			</button>

			<button
				onclick={clearSeenHistory}
				class="flex items-center gap-3 rounded-xl bg-surface-container px-4 py-3 text-left hover:bg-surface-container-high"
			>
				<svg class="h-5 w-5 text-on-surface-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-10-8-10-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10 10 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
					<path d="M1 1l22 22" />
				</svg>
				<div>
					<p class="text-sm font-medium">Clear "seen" markers</p>
					<p class="text-xs text-on-surface-dim">Un-fades pins in Feed that you've already opened</p>
				</div>
			</button>
		</div>
	</section>

	<!-- Subscriptions -->
	<section class="mb-8">
		<h2 class="mb-1 text-lg font-semibold">Subscriptions</h2>
		<p class="mb-3 text-sm text-on-surface-dim">
			{follows.users.length} user{follows.users.length === 1 ? '' : 's'},
			{follows.topics.length} topic{follows.topics.length === 1 ? '' : 's'},
			{follows.boards.length} board{follows.boards.length === 1 ? '' : 's'}
		</p>

		<div class="flex flex-wrap gap-2">
			<button
				onclick={exportSubscriptions}
				class="rounded-xl bg-surface-container-high px-4 py-2 text-sm font-medium hover:bg-surface-bright"
			>
				Export as JSON
			</button>
			<button
				onclick={triggerImport}
				class="rounded-xl bg-surface-container-high px-4 py-2 text-sm font-medium hover:bg-surface-bright"
			>
				Import JSON
			</button>
		</div>

		{#if importStatus}
			<p class="mt-2 text-xs text-green-400">{importStatus}</p>
		{/if}
		{#if importError}
			<p class="mt-2 text-xs text-error">{importError}</p>
		{/if}

		{#if follows.hiddenPinners.length > 0}
			<div class="mt-4 rounded-xl bg-surface-container p-3">
				<p class="mb-2 text-xs font-medium text-on-surface-dim">
					Blocked pinners ({follows.hiddenPinners.length})
				</p>
				<div class="flex flex-wrap gap-1.5">
					{#each follows.hiddenPinners as username (username)}
						<button
							onclick={() => unhidePinner(username)}
							class="flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-xs hover:bg-surface-bright"
							title="Unblock {username}"
						>
							<span>@{username}</span>
							<span class="text-error">×</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</section>

	<!-- Donate -->
	<section class="mb-8">
		<h2 class="mb-1 text-lg font-semibold">Donate</h2>
		<p class="mb-3 text-sm text-on-surface-dim">
			If you're happy with this app, consider donating.
		</p>
		<div class="rounded-xl bg-surface-container p-4">
			<p class="text-sm font-medium">Monero (XMR)</p>
			<p class="mt-2 break-all font-mono text-xs text-on-surface-dim select-all">
				{MONERO_ADDRESS}
			</p>
			<button
				onclick={copyMonero}
				class="mt-3 flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary"
			>
				{#if copiedDonate}
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path d="M5 13l4 4L19 7" />
					</svg>
					Copied
				{:else}
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<rect x="9" y="9" width="13" height="13" rx="2" />
						<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
					</svg>
					Copy address
				{/if}
			</button>
		</div>
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
