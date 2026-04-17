<script lang="ts">
	import { page } from '$app/state';

	const tabs = [
		{
			label: 'Search',
			href: '/',
			icon: 'search',
			match: (path: string) => path === '/' || path.startsWith('/search')
		},
		{
			label: 'Feed',
			href: '/feed',
			icon: 'feed',
			match: (path: string) => path.startsWith('/feed')
		},
		{
			label: 'Favorites',
			href: '/favorites',
			icon: 'heart',
			match: (path: string) => path.startsWith('/favorites')
		},
		{
			label: 'Collages',
			href: '/collages',
			icon: 'collage',
			match: (path: string) => path.startsWith('/collages')
		},
		{
			label: 'Settings',
			href: '/settings',
			icon: 'settings',
			match: (path: string) => path.startsWith('/settings')
		}
	];

	const currentPath = $derived(page.url.pathname);
</script>

<nav class="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-outline-dim bg-surface-container">
	<div class="mx-auto flex max-w-lg items-center justify-around">
		{#each tabs as tab}
			{@const active = tab.match(currentPath)}
			<a
				href={tab.href}
				class="flex flex-1 flex-col items-center gap-1 py-3 transition-colors {active
					? 'text-primary'
					: 'text-on-surface-dim'}"
			>
				{#if tab.icon === 'search'}
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="8" />
						<path d="m21 21-4.3-4.3" />
					</svg>
				{:else if tab.icon === 'feed'}
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
						<circle cx="5" cy="19" r="1" fill={active ? 'currentColor' : 'none'} />
					</svg>
				{:else if tab.icon === 'heart'}
					<svg class="h-6 w-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
					</svg>
				{:else if tab.icon === 'collage'}
					<svg class="h-6 w-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
						<rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
					</svg>
				{:else if tab.icon === 'settings'}
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="3" />
						<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
					</svg>
				{/if}
				<span class="text-xs font-medium">{tab.label}</span>
			</a>
		{/each}
	</div>
</nav>
