import type { Pin, Collage } from '$lib/api/types.ts';

interface CollagesState {
	collages: Collage[];
}

let collagesState = $state<CollagesState>({
	collages: []
});
let loaded = false;

function load(): void {
	if (loaded) return;
	try {
		const stored = localStorage.getItem('pinfold-collages');
		if (stored) {
			collagesState.collages = JSON.parse(stored);
		}
	} catch {
		// Use defaults
	}
	loaded = true;
}

function save(): void {
	try {
		localStorage.setItem('pinfold-collages', JSON.stringify(collagesState.collages));
	} catch {
		// Storage full
	}
}

function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

const COVER_COLORS = [
	'#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6',
	'#ef4444', '#06b6d4', '#84cc16', '#f97316', '#a855f7'
];

export function createCollage(name: string): Collage {
	load();
	const collage: Collage = {
		id: generateId(),
		name,
		coverColor: COVER_COLORS[collagesState.collages.length % COVER_COLORS.length],
		pins: [],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};
	collagesState.collages.unshift(collage);
	save();
	return collage;
}

export function duplicateCollage(name: string, pins: Pin[]): Collage {
	load();
	const collage: Collage = {
		id: generateId(),
		name,
		coverColor: COVER_COLORS[collagesState.collages.length % COVER_COLORS.length],
		pins: [...pins],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};
	collagesState.collages.unshift(collage);
	save();
	return collage;
}

export function deleteCollage(collageId: string): void {
	load();
	collagesState.collages = collagesState.collages.filter((c) => c.id !== collageId);
	save();
}

export function renameCollage(collageId: string, name: string): void {
	load();
	const collage = collagesState.collages.find((c) => c.id === collageId);
	if (collage) {
		collage.name = name;
		collage.updatedAt = new Date().toISOString();
		save();
	}
}

export function addPinToCollage(collageId: string, pin: Pin): boolean {
	load();
	const collage = collagesState.collages.find((c) => c.id === collageId);
	if (!collage) return false;
	if (collage.pins.some((p) => p.id === pin.id)) return false;
	collage.pins.unshift(pin);
	collage.updatedAt = new Date().toISOString();
	save();
	return true;
}

export function removePinFromCollage(collageId: string, pinId: string): void {
	load();
	const collage = collagesState.collages.find((c) => c.id === collageId);
	if (collage) {
		collage.pins = collage.pins.filter((p) => p.id !== pinId);
		collage.updatedAt = new Date().toISOString();
		save();
	}
}

export function isPinInCollage(collageId: string, pinId: string): boolean {
	load();
	const collage = collagesState.collages.find((c) => c.id === collageId);
	return collage?.pins.some((p) => p.id === pinId) ?? false;
}

export function getCollage(collageId: string): Collage | undefined {
	load();
	return collagesState.collages.find((c) => c.id === collageId);
}

/**
 * Encode a collage into a compact share string.
 * Format: base64url-encoded JSON with name and pin IDs.
 */
export function encodeCollageShare(collage: Collage): string {
	const payload = JSON.stringify({
		n: collage.name,
		p: collage.pins.map((pin) => pin.id)
	});
	// base64url encode (no padding, URL-safe chars)
	return btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a share string back into a collage name and pin IDs.
 */
export function decodeCollageShare(data: string): { name: string; pinIds: string[] } | null {
	try {
		const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
		const json = atob(base64);
		const parsed = JSON.parse(json);
		if (typeof parsed.n !== 'string' || !Array.isArray(parsed.p)) return null;
		return {
			name: parsed.n,
			pinIds: parsed.p.map(String)
		};
	} catch {
		return null;
	}
}

export function useCollages() {
	load();
	return {
		get collages() {
			return collagesState.collages;
		},
		get count() {
			return collagesState.collages.length;
		},
		create: createCollage,
		duplicate: duplicateCollage,
		delete: deleteCollage,
		rename: renameCollage,
		addPin: addPinToCollage,
		removePin: removePinFromCollage,
		isPinIn: isPinInCollage,
		get: getCollage,
		encodeShare: encodeCollageShare,
		decodeShare: decodeCollageShare
	};
}
