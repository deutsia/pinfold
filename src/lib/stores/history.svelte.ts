import type { Pin } from '$lib/api/types.ts';

/**
 * Local viewing history — stores metadata for every pin the user has opened
 * in detail view. Images are not downloaded; only the image URLs and basic
 * metadata live in localStorage, and FetchImage re-loads them on demand.
 */

export interface HistoryEntry {
	pin: Pin;
	viewedAt: number;
}

interface HistoryState {
	entries: HistoryEntry[];
}

const MAX_HISTORY = 1000;

let state = $state<HistoryState>({ entries: [] });
let loaded = false;

function load(): void {
	if (loaded) return;
	try {
		const raw = localStorage.getItem('pinfold-history');
		if (raw) {
			const parsed = JSON.parse(raw) as HistoryEntry[];
			if (Array.isArray(parsed)) state.entries = parsed;
		}
	} catch {
		// Use defaults
	}
	loaded = true;
}

function save(): void {
	try {
		localStorage.setItem('pinfold-history', JSON.stringify(state.entries));
	} catch {
		// Storage full — drop oldest half and retry once
		try {
			state.entries = state.entries.slice(0, Math.floor(state.entries.length / 2));
			localStorage.setItem('pinfold-history', JSON.stringify(state.entries));
		} catch {
			// Give up
		}
	}
}

/**
 * Record that the user viewed this pin. If the pin is already in history,
 * its entry is moved to the front and the `viewedAt` timestamp is refreshed.
 */
export function addToHistory(pin: Pin): void {
	load();
	const existing = state.entries.findIndex((e) => e.pin.id === pin.id);
	if (existing !== -1) state.entries.splice(existing, 1);
	state.entries.unshift({ pin, viewedAt: Date.now() });
	if (state.entries.length > MAX_HISTORY) {
		state.entries = state.entries.slice(0, MAX_HISTORY);
	}
	save();
}

export function removeFromHistory(pinId: string): void {
	load();
	state.entries = state.entries.filter((e) => e.pin.id !== pinId);
	save();
}

export function clearHistory(): void {
	state.entries = [];
	save();
}

export function useHistory() {
	load();
	return {
		get entries() { return state.entries; },
		get count() { return state.entries.length; },
		add: addToHistory,
		remove: removeFromHistory,
		clear: clearHistory
	};
}
