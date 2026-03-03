const MAX_HISTORY = 20;

interface SearchState {
	history: string[];
}

let searchState = $state<SearchState>({
	history: []
});
let loaded = false;

function load(): void {
	if (loaded) return;
	try {
		const stored = localStorage.getItem('pinfold-search-history');
		if (stored) {
			searchState.history = JSON.parse(stored);
		}
	} catch {
		// Use defaults
	}
	loaded = true;
}

function save(): void {
	try {
		localStorage.setItem('pinfold-search-history', JSON.stringify(searchState.history));
	} catch {
		// Storage full
	}
}

/**
 * Add a query to search history.
 */
export function addToHistory(query: string): void {
	load();
	const trimmed = query.trim();
	if (!trimmed) return;

	// Remove duplicate if exists
	searchState.history = searchState.history.filter((q) => q !== trimmed);
	// Add to front
	searchState.history.unshift(trimmed);
	// Trim to max
	if (searchState.history.length > MAX_HISTORY) {
		searchState.history = searchState.history.slice(0, MAX_HISTORY);
	}
	save();
}

/**
 * Clear all search history.
 */
export function clearHistory(): void {
	searchState.history = [];
	save();
}

/**
 * Get the search store for reactive access.
 */
export function useSearchHistory() {
	load();
	return {
		get history() {
			return searchState.history;
		},
		add: addToHistory,
		clear: clearHistory
	};
}
