<script lang="ts">
	import { useFollows } from '$lib/stores/follows.svelte.ts';
	import { suggestedTopics } from '$lib/data/suggested-topics.ts';

	let { onchange }: { onchange?: (topic: string, followed: boolean) => void } = $props();

	const follows = useFollows();

	function toggle(topic: string) {
		if (follows.isTopicFollowed(topic)) {
			follows.unfollowTopic(topic);
			onchange?.(topic, false);
		} else {
			follows.followTopic(topic);
			onchange?.(topic, true);
		}
	}
</script>

<div class="space-y-5">
	{#each suggestedTopics as category (category.name)}
		<div>
			<h3 class="mb-2 text-sm font-semibold text-on-surface-dim">{category.name}</h3>
			<div class="flex flex-wrap gap-2">
				{#each category.topics as topic (topic)}
					{@const followed = follows.isTopicFollowed(topic)}
					<button
						onclick={() => toggle(topic)}
						class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors {followed
							? 'bg-primary text-on-primary'
							: 'bg-surface-container-high text-on-surface hover:bg-surface-bright'}"
					>
						{#if followed}
							<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
								<path d="M5 13l4 4L19 7" />
							</svg>
						{:else}
							<span class="text-on-surface-dim">#</span>
						{/if}
						{topic}
					</button>
				{/each}
			</div>
		</div>
	{/each}
</div>
