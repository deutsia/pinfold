import type { Pin } from '$lib/api/types.ts';

interface FavoritesState {
	pins: Pin[];
}

let favoritesState = $state<FavoritesState>({
	pins: []
});
let loaded = false;

function load(): void {
	if (loaded) return;
	try {
		const stored = localStorage.getItem('pinfold-favorites');
		if (stored) {
			favoritesState.pins = JSON.parse(stored);
		}
	} catch {
		// Use defaults
	}
	loaded = true;
}

function save(): void {
	try {
		localStorage.setItem('pinfold-favorites', JSON.stringify(favoritesState.pins));
	} catch {
		// Storage full
	}
}

/**
 * Add a pin to favorites.
 */
export function addFavorite(pin: Pin): void {
	load();
	if (favoritesState.pins.some((p) => p.id === pin.id)) return;
	favoritesState.pins.unshift(pin);
	save();
}

/**
 * Remove a pin from favorites.
 */
export function removeFavorite(pinId: string): void {
	load();
	favoritesState.pins = favoritesState.pins.filter((p) => p.id !== pinId);
	save();
}

/**
 * Check if a pin is favorited.
 */
export function isFavorited(pinId: string): boolean {
	load();
	return favoritesState.pins.some((p) => p.id === pinId);
}

/**
 * Toggle favorite status.
 */
export function toggleFavorite(pin: Pin): boolean {
	if (isFavorited(pin.id)) {
		removeFavorite(pin.id);
		return false;
	} else {
		addFavorite(pin);
		return true;
	}
}

/**
 * Get the favorites store for reactive access.
 */
export function useFavorites() {
	load();
	return {
		get pins() {
			return favoritesState.pins;
		},
		add: addFavorite,
		remove: removeFavorite,
		isFavorited,
		toggle: toggleFavorite,
		get count() {
			return favoritesState.pins.length;
		}
	};
}
