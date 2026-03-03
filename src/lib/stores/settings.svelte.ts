export type ThemeColor = 'ocean' | 'rose' | 'sage' | 'amber' | 'lavender' | 'sunset';
export type ThemeMode = 'dark' | 'light';

export interface AppSettings {
	proxyUrl: string;
	theme: ThemeMode;
	themeColor: ThemeColor;
}

export const THEME_COLORS: { id: ThemeColor; label: string; preview: string }[] = [
	{ id: 'ocean', label: 'Ocean', preview: '#6d9eff' },
	{ id: 'rose', label: 'Rose', preview: '#f28dba' },
	{ id: 'sage', label: 'Sage', preview: '#7ec89f' },
	{ id: 'amber', label: 'Amber', preview: '#f0b060' },
	{ id: 'lavender', label: 'Lavender', preview: '#b49dff' },
	{ id: 'sunset', label: 'Sunset', preview: '#f0845c' }
];

export interface ProxyInstance {
	name: string;
	clearnet: string | null;
	tor: string | null;
	i2p: string | null;
	country: string;
	unofficial?: boolean;
}

export const PROXY_INSTANCES: ProxyInstance[] = [
	{
		name: 'ducks.party',
		clearnet: 'https://binternet.ducks.party',
		tor: null,
		i2p: null,
		country: 'NL'
	},
	{
		name: 'opnxng.com',
		clearnet: 'https://bn.opnxng.com',
		tor: null,
		i2p: null,
		country: 'SG'
	},
	{
		name: 'privacyredirect.com',
		clearnet: 'https://binternet.privacyredirect.com',
		tor: null,
		i2p: null,
		country: 'FI'
	},
	{
		name: 'lunar.icu',
		clearnet: 'https://binternet.lunar.icu',
		tor: null,
		i2p: null,
		country: 'DE'
	},
	{
		name: 'proxyrr4...b32.i2p',
		clearnet: null,
		tor: null,
		i2p: 'http://proxyrr4qmb46amdiufytunrs6joupqzedxgakcgddmbwbawjk7a.b32.i2p',
		country: '??',
		unofficial: true
	}
];

const defaultSettings: AppSettings = {
	proxyUrl: '',
	theme: 'dark',
	themeColor: 'rose'
};

let settings = $state<AppSettings>({ ...defaultSettings });
let loaded = false;

export function getSettings(): AppSettings {
	return settings;
}

export function loadSettings(): void {
	if (loaded) return;
	try {
		const stored = localStorage.getItem('pinfold-settings');
		if (stored) {
			const parsed = JSON.parse(stored) as Partial<AppSettings>;
			// Reject an invalid proxy URL that may have been written by a tampered store.
			if (parsed.proxyUrl !== undefined && !isValidProxyUrl(parsed.proxyUrl)) {
				parsed.proxyUrl = '';
			}
			settings = { ...defaultSettings, ...parsed };
		}
	} catch {
		// Use defaults
	}
	loaded = true;
	applyTheme();
}

function saveSettings(): void {
	try {
		localStorage.setItem('pinfold-settings', JSON.stringify(settings));
	} catch {
		// Storage full or unavailable
	}
}

function applyTheme(): void {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	root.setAttribute('data-theme', settings.themeColor);
	root.setAttribute('data-mode', settings.theme);
	applySystemBars();
}

async function applySystemBars(): Promise<void> {
	const isDark = settings.theme === 'dark';
	try {
		const { registerPlugin } = await import('@capacitor/core');
		const SystemBars = registerPlugin<{
			setStyle(opts: { isDark: boolean }): Promise<void>;
		}>('SystemBars');
		await SystemBars.setStyle({ isDark });
	} catch {
		// Plugin not available (e.g., in browser)
	}
	if (typeof document !== 'undefined') {
		const meta = document.querySelector('meta[name="theme-color"]');
		if (meta) {
			meta.setAttribute('content', isDark ? '#000000' : '#f5f5f5');
		}
	}
}

/**
 * Validate that a proxy URL is a well-formed http or https URL.
 * Rejects javascript:, file:, data: and other non-network schemes.
 */
function isValidProxyUrl(url: string): boolean {
	if (!url) return true; // empty = disabled, always valid
	try {
		const parsed = new URL(url);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:';
	} catch {
		return false;
	}
}

export function updateSettings(updates: Partial<AppSettings>): void {
	if ('proxyUrl' in updates && updates.proxyUrl !== undefined) {
		if (!isValidProxyUrl(updates.proxyUrl)) {
			throw new Error('Proxy URL must be a valid http or https URL');
		}
	}
	Object.assign(settings, updates);
	saveSettings();
	applyTheme();
}

export function resetSettings(): void {
	settings = { ...defaultSettings };
	saveSettings();
	applyTheme();
}

export function useSettings() {
	loadSettings();
	return {
		get current() {
			return settings;
		},
		update: updateSettings,
		reset: resetSettings
	};
}
