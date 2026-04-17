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

/**
 * Resolve a CSS custom property to a `#rrggbb` string by temporarily
 * rendering it on a hidden element and reading back the computed color.
 * Needed because Android's Color.parseColor() can't handle oklch().
 */
function resolveCssColor(varName: string, fallback: string): string {
	if (typeof document === 'undefined') return fallback;
	const probe = document.createElement('div');
	probe.style.color = `var(${varName})`;
	probe.style.display = 'none';
	document.body.appendChild(probe);
	const rgb = getComputedStyle(probe).color;
	document.body.removeChild(probe);
	const match = rgb.match(/rgba?\(([^)]+)\)/);
	if (!match) return fallback;
	const parts = match[1].split(',').map((s) => parseFloat(s.trim()));
	if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return fallback;
	const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
	return `#${hex(parts[0])}${hex(parts[1])}${hex(parts[2])}`;
}

async function applySystemBars(): Promise<void> {
	const isDark = settings.theme === 'dark';
	const defaultColor = isDark ? '#000000' : '#f5f5f5';
	// Wait a frame so the new [data-theme]/[data-mode] attributes are reflected
	// in computed styles before we sample them.
	if (typeof requestAnimationFrame !== 'undefined') {
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	}
	const statusBarColor = resolveCssColor('--color-surface', defaultColor);
	const navigationBarColor = resolveCssColor('--color-surface-container', defaultColor);
	try {
		const { registerPlugin } = await import('@capacitor/core');
		const SystemBars = registerPlugin<{
			setStyle(opts: {
				isDark: boolean;
				statusBarColor?: string;
				navigationBarColor?: string;
			}): Promise<void>;
		}>('SystemBars');
		await SystemBars.setStyle({ isDark, statusBarColor, navigationBarColor });
	} catch {
		// Plugin not available (e.g., in browser)
	}
	if (typeof document !== 'undefined') {
		const meta = document.querySelector('meta[name="theme-color"]');
		if (meta) {
			meta.setAttribute('content', statusBarColor);
		}
	}
}

/**
 * Validate that a proxy URL uses an allowed scheme and is well-formed.
 * Allows http:// for .onion/.i2p addresses, requires https:// otherwise.
 * Returns the validated URL or empty string if invalid.
 */
function validateProxyUrl(url: string): string {
	const trimmed = url.trim();
	if (!trimmed) return '';

	try {
		const parsed = new URL(trimmed);
		const isOnion = parsed.hostname.endsWith('.onion');
		const isI2P = parsed.hostname.endsWith('.b32.i2p');
		const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

		// Only allow http/https schemes
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
			return '';
		}

		// Require https for clearnet, allow http for onion/i2p/localhost
		if (parsed.protocol === 'http:' && !isOnion && !isI2P && !isLocalhost) {
			return '';
		}

		return trimmed;
	} catch {
		return '';
	}
}

export function updateSettings(updates: Partial<AppSettings>): void {
	if (updates.proxyUrl !== undefined) {
		updates.proxyUrl = validateProxyUrl(updates.proxyUrl);
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
