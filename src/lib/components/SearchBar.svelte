<script lang="ts">
	interface Props {
		value?: string;
		placeholder?: string;
		autofocus?: boolean;
		onsubmit?: (query: string) => void;
	}

	let { value = $bindable(''), placeholder = 'Search Pinterest...', autofocus = false, onsubmit }: Props = $props();

	function handleSubmit(e: Event) {
		e.preventDefault();
		const trimmed = value.trim();
		if (trimmed && onsubmit) {
			onsubmit(trimmed);
		}
	}

	function handleClear() {
		value = '';
	}
</script>

<form onsubmit={handleSubmit} class="w-full">
	<div class="relative flex items-center">
		<!-- Search icon -->
		<svg
			class="pointer-events-none absolute left-4 h-5 w-5 text-on-surface-dim"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<circle cx="11" cy="11" r="8" />
			<path d="m21 21-4.3-4.3" />
		</svg>

		<input
			type="text"
			bind:value
			{placeholder}
			{autofocus}
			class="w-full rounded-full bg-surface-container-high py-3 pr-10 pl-12 text-on-surface placeholder:text-on-surface-dim focus:ring-2 focus:ring-primary focus:outline-none"
		/>

		<!-- Clear button -->
		{#if value}
			<button
				type="button"
				onclick={handleClear}
				class="absolute right-3 rounded-full p-1 text-on-surface-dim hover:text-on-surface"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M6 18 18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>
</form>
