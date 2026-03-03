export interface PinImages {
	original: string;
	'736x': string;
	'236x': string;
}

export interface Pinner {
	username: string;
	fullName: string;
	avatarUrl: string;
}

export interface Pin {
	id: string;
	description: string;
	title: string;
	images: PinImages;
	carouselImages: PinImages[];
	link: string | null;
	boardId: string;
	boardName: string;
	boardUrl: string;
	pinner: Pinner;
	dominantColor: string;
	createdAt: string | null;
}

export interface Board {
	id: string;
	name: string;
	description: string;
	url: string;
	pinCount: number;
	imageUrl: string | null;
	owner: Pinner;
}

export interface UserProfile {
	username: string;
	fullName: string;
	avatarUrl: string;
	bio: string;
	followerCount: number;
	pinCount: number;
	boardCount: number;
}

export interface Collage {
	id: string;
	name: string;
	coverColor: string;
	pins: Pin[];
	createdAt: string;
	updatedAt: string;
}

export interface SearchResult {
	pins: Pin[];
	bookmark: string | null;
}

export interface BoardResult {
	board: Board;
	pins: Pin[];
	bookmark: string | null;
}

export interface UserPinsResult {
	pins: Pin[];
	bookmark: string | null;
}
