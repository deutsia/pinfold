/**
 * Local-only subscription list — users, topics (saved searches), and boards
 * the user wants to see in their Feed, plus blocklists used by Phase-2
 * filters (hidden pinners, seen-pin tracking).
 *
 * All data stays in localStorage; nothing is sent to any external account.
 */

export interface FollowedUser {
	username: string;
	fullName?: string;
	avatarUrl?: string;
	addedAt: number;
}

export interface FollowedTopic {
	query: string;
	addedAt: number;
}

export interface FollowedBoard {
	slug: string;
	id?: string;
	name?: string;
	owner?: string;
	addedAt: number;
}

interface FollowsState {
	users: FollowedUser[];
	topics: FollowedTopic[];
	boards: FollowedBoard[];
	hiddenPinners: string[];
	hiddenPinIds: string[];
	seenPinIds: string[];
}

const MAX_SEEN = 2000;

const defaultState: FollowsState = {
	users: [],
	topics: [],
	boards: [],
	hiddenPinners: [],
	hiddenPinIds: [],
	seenPinIds: []
};

let state = $state<FollowsState>({ ...defaultState });
let loaded = false;

function load(): void {
	if (loaded) return;
	try {
		const raw = localStorage.getItem('pinfold-follows');
		if (raw) {
			const parsed = JSON.parse(raw) as Partial<FollowsState>;
			state = { ...defaultState, ...parsed };
		}
	} catch {
		// Use defaults
	}
	loaded = true;
}

function save(): void {
	try {
		localStorage.setItem('pinfold-follows', JSON.stringify(state));
	} catch {
		// Storage full
	}
}

// ---------- Users ----------

export function followUser(user: FollowedUser): void {
	load();
	if (state.users.some((u) => u.username === user.username)) return;
	state.users = [{ ...user, addedAt: user.addedAt || Date.now() }, ...state.users];
	save();
}

export function unfollowUser(username: string): void {
	load();
	state.users = state.users.filter((u) => u.username !== username);
	save();
}

export function isUserFollowed(username: string): boolean {
	load();
	return state.users.some((u) => u.username === username);
}

// ---------- Topics ----------

export function followTopic(query: string): void {
	load();
	const trimmed = query.trim();
	if (!trimmed) return;
	if (state.topics.some((t) => t.query.toLowerCase() === trimmed.toLowerCase())) return;
	state.topics = [{ query: trimmed, addedAt: Date.now() }, ...state.topics];
	save();
}

export function unfollowTopic(query: string): void {
	load();
	state.topics = state.topics.filter((t) => t.query.toLowerCase() !== query.toLowerCase());
	save();
}

export function isTopicFollowed(query: string): boolean {
	load();
	return state.topics.some((t) => t.query.toLowerCase() === query.toLowerCase());
}

// ---------- Boards ----------

export function followBoard(board: FollowedBoard): void {
	load();
	if (state.boards.some((b) => b.slug === board.slug)) return;
	state.boards = [{ ...board, addedAt: board.addedAt || Date.now() }, ...state.boards];
	save();
}

export function unfollowBoard(slug: string): void {
	load();
	state.boards = state.boards.filter((b) => b.slug !== slug);
	save();
}

export function isBoardFollowed(slug: string): boolean {
	load();
	return state.boards.some((b) => b.slug === slug);
}

// ---------- Hidden pinners / pins ----------

export function hidePinner(username: string): void {
	load();
	if (!username) return;
	if (state.hiddenPinners.includes(username)) return;
	state.hiddenPinners = [...state.hiddenPinners, username];
	save();
}

export function unhidePinner(username: string): void {
	load();
	state.hiddenPinners = state.hiddenPinners.filter((u) => u !== username);
	save();
}

export function isPinnerHidden(username: string): boolean {
	load();
	return state.hiddenPinners.includes(username);
}

export function hidePin(pinId: string): void {
	load();
	if (state.hiddenPinIds.includes(pinId)) return;
	state.hiddenPinIds = [...state.hiddenPinIds, pinId];
	save();
}

export function isPinHidden(pinId: string): boolean {
	load();
	return state.hiddenPinIds.includes(pinId);
}

// ---------- Seen tracking ----------

export function markSeen(pinId: string): void {
	load();
	if (state.seenPinIds.includes(pinId)) return;
	const next = [pinId, ...state.seenPinIds];
	state.seenPinIds = next.length > MAX_SEEN ? next.slice(0, MAX_SEEN) : next;
	save();
}

export function isSeen(pinId: string): boolean {
	load();
	return state.seenPinIds.includes(pinId);
}

export function clearSeen(): void {
	load();
	state.seenPinIds = [];
	save();
}

// ---------- Bulk import / export ----------

export interface FollowsExport {
	version: 1;
	users: FollowedUser[];
	topics: FollowedTopic[];
	boards: FollowedBoard[];
	hiddenPinners: string[];
}

export function exportFollows(): FollowsExport {
	load();
	return {
		version: 1,
		users: state.users,
		topics: state.topics,
		boards: state.boards,
		hiddenPinners: state.hiddenPinners
	};
}

export function importFollows(data: Partial<FollowsExport>, mode: 'merge' | 'replace' = 'merge'): void {
	load();
	const safeUsers = Array.isArray(data.users) ? data.users : [];
	const safeTopics = Array.isArray(data.topics) ? data.topics : [];
	const safeBoards = Array.isArray(data.boards) ? data.boards : [];
	const safeHidden = Array.isArray(data.hiddenPinners) ? data.hiddenPinners : [];

	if (mode === 'replace') {
		state.users = safeUsers;
		state.topics = safeTopics;
		state.boards = safeBoards;
		state.hiddenPinners = safeHidden;
	} else {
		const usernames = new Set(state.users.map((u) => u.username));
		for (const u of safeUsers) if (!usernames.has(u.username)) state.users.push(u);

		const topicSet = new Set(state.topics.map((t) => t.query.toLowerCase()));
		for (const t of safeTopics) if (!topicSet.has(t.query.toLowerCase())) state.topics.push(t);

		const boardSlugs = new Set(state.boards.map((b) => b.slug));
		for (const b of safeBoards) if (!boardSlugs.has(b.slug)) state.boards.push(b);

		const hiddenSet = new Set(state.hiddenPinners);
		for (const h of safeHidden) hiddenSet.add(h);
		state.hiddenPinners = [...hiddenSet];
	}
	save();
}

// ---------- Reactive accessor ----------

export function useFollows() {
	load();
	return {
		get users() { return state.users; },
		get topics() { return state.topics; },
		get boards() { return state.boards; },
		get hiddenPinners() { return state.hiddenPinners; },
		get totalSources() { return state.users.length + state.topics.length + state.boards.length; },
		followUser,
		unfollowUser,
		isUserFollowed,
		followTopic,
		unfollowTopic,
		isTopicFollowed,
		followBoard,
		unfollowBoard,
		isBoardFollowed,
		hidePinner,
		unhidePinner,
		isPinnerHidden,
		hidePin,
		isPinHidden,
		markSeen,
		isSeen,
		clearSeen,
		exportFollows,
		importFollows
	};
}
