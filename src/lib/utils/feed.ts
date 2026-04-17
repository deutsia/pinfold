import { getUserPins, searchPins, getBoardPins } from '$lib/api/pinterest.ts';
import type { Pin } from '$lib/api/types.ts';
import type {
	FollowedBoard,
	FollowedTopic,
	FollowedUser
} from '$lib/stores/follows.svelte.ts';

/**
 * Merge and dedupe pins from multiple sources into one feed.
 *
 * Each source contributes its pins in order; we interleave them
 * round-robin so no single source dominates the top of the feed,
 * then strip duplicates by pin id.
 */

export interface FeedSource {
	key: string;
	label: string;
	type: 'user' | 'topic' | 'board';
	value: string;
}

export interface FeedPageResult {
	pins: Pin[];
	sourceErrors: Record<string, string>;
	fetchedAt: number;
}

function roundRobinMerge(lists: Pin[][]): Pin[] {
	const merged: Pin[] = [];
	const seen = new Set<string>();
	const max = Math.max(0, ...lists.map((l) => l.length));
	for (let i = 0; i < max; i++) {
		for (const list of lists) {
			const pin = list[i];
			if (!pin || seen.has(pin.id)) continue;
			seen.add(pin.id);
			merged.push(pin);
		}
	}
	return merged;
}

/**
 * Run async tasks with a concurrency cap. Returns results in the same order
 * as the input. If a task throws, the error is captured instead of rejecting
 * the whole batch.
 */
async function runWithConcurrency<T>(
	tasks: (() => Promise<T>)[],
	concurrency: number
): Promise<({ ok: true; value: T } | { ok: false; error: unknown })[]> {
	const results: ({ ok: true; value: T } | { ok: false; error: unknown })[] = new Array(tasks.length);
	let cursor = 0;
	const workers: Promise<void>[] = [];
	for (let w = 0; w < Math.min(concurrency, tasks.length); w++) {
		workers.push(
			(async () => {
				while (true) {
					const i = cursor++;
					if (i >= tasks.length) return;
					try {
						results[i] = { ok: true, value: await tasks[i]() };
					} catch (error) {
						results[i] = { ok: false, error };
					}
				}
			})()
		);
	}
	await Promise.all(workers);
	return results;
}

export function buildFeedSources(opts: {
	users: FollowedUser[];
	topics: FollowedTopic[];
	boards: FollowedBoard[];
}): FeedSource[] {
	const sources: FeedSource[] = [];
	for (const u of opts.users) {
		sources.push({
			key: `user:${u.username}`,
			label: `@${u.username}`,
			type: 'user',
			value: u.username
		});
	}
	for (const t of opts.topics) {
		sources.push({
			key: `topic:${t.query.toLowerCase()}`,
			label: `#${t.query}`,
			type: 'topic',
			value: t.query
		});
	}
	for (const b of opts.boards) {
		sources.push({
			key: `board:${b.slug}`,
			label: b.name || b.slug,
			type: 'board',
			value: b.slug
		});
	}
	return sources;
}

async function fetchSource(source: FeedSource, boardId?: string): Promise<Pin[]> {
	if (source.type === 'user') {
		const result = await getUserPins(source.value);
		return result.pins;
	}
	if (source.type === 'topic') {
		const result = await searchPins(source.value);
		return result.pins;
	}
	const result = await getBoardPins(source.value, undefined, boardId);
	return result.pins;
}

export async function fetchFeed(
	sources: FeedSource[],
	opts: {
		concurrency?: number;
		boardIds?: Record<string, string>;
	} = {}
): Promise<FeedPageResult> {
	const concurrency = opts.concurrency ?? 3;
	const boardIds = opts.boardIds ?? {};

	const tasks = sources.map((s) => () => fetchSource(s, boardIds[s.value]));
	const results = await runWithConcurrency(tasks, concurrency);

	const perSource: Pin[][] = [];
	const sourceErrors: Record<string, string> = {};

	results.forEach((r, i) => {
		const src = sources[i];
		if (r.ok) {
			perSource.push(r.value);
		} else {
			sourceErrors[src.key] =
				r.error instanceof Error ? r.error.message : 'Failed to load';
		}
	});

	return {
		pins: roundRobinMerge(perSource),
		sourceErrors,
		fetchedAt: Date.now()
	};
}

// ---------- Cache ----------

export interface FeedCache {
	pins: Pin[];
	fetchedAt: number;
	sourceKeys: string[];
}

const CACHE_KEY = 'pinfold-feed-cache';

export function loadFeedCache(): FeedCache | null {
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as FeedCache;
		if (!parsed || !Array.isArray(parsed.pins)) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function saveFeedCache(pins: Pin[], sourceKeys: string[]): void {
	try {
		// Cap cache at 500 pins to keep localStorage size reasonable
		const capped = pins.slice(0, 500);
		const cache: FeedCache = {
			pins: capped,
			fetchedAt: Date.now(),
			sourceKeys
		};
		localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
	} catch {
		// Storage full
	}
}

const LAST_SEEN_KEY = 'pinfold-feed-last-seen';

/**
 * Record the id of the top pin the user last scrolled past so we can show
 * a "N new pins since last visit" badge.
 */
export function setLastSeenTopPin(pinId: string): void {
	try {
		localStorage.setItem(LAST_SEEN_KEY, pinId);
	} catch {
		// Ignore
	}
}

export function getLastSeenTopPin(): string | null {
	try {
		return localStorage.getItem(LAST_SEEN_KEY);
	} catch {
		return null;
	}
}

export function countNewSinceLastSeen(pins: Pin[]): number {
	const last = getLastSeenTopPin();
	if (!last) return 0;
	const idx = pins.findIndex((p) => p.id === last);
	return idx === -1 ? pins.length : idx;
}
