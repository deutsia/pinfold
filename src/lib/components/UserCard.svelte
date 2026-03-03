<script lang="ts">
	import type { UserProfile } from '$lib/api/types.ts';
	import FetchImage from './FetchImage.svelte';

	interface Props {
		user: UserProfile;
	}

	let { user }: Props = $props();
</script>

<div class="px-4 py-6 text-center">
	{#if user.avatarUrl}
		<FetchImage
			src={user.avatarUrl}
			alt={user.fullName}
			class="mx-auto mb-4 h-24 w-24 rounded-full object-cover"
		/>
	{:else}
		<div class="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-primary text-3xl font-bold text-on-primary">
			{user.fullName.charAt(0) || user.username.charAt(0)}
		</div>
	{/if}

	<h1 class="text-2xl font-bold">{user.fullName || user.username}</h1>
	<p class="text-on-surface-dim">@{user.username}</p>

	{#if user.bio}
		<p class="mx-auto mt-3 max-w-md text-on-surface-dim">{user.bio}</p>
	{/if}

	<div class="mt-4 flex items-center justify-center gap-6 text-sm">
		<div>
			<span class="font-semibold">{user.pinCount.toLocaleString()}</span>
			<span class="text-on-surface-dim"> pins</span>
		</div>
		<div>
			<span class="font-semibold">{user.followerCount.toLocaleString()}</span>
			<span class="text-on-surface-dim"> followers</span>
		</div>
		<div>
			<span class="font-semibold">{user.boardCount.toLocaleString()}</span>
			<span class="text-on-surface-dim"> boards</span>
		</div>
	</div>
</div>
