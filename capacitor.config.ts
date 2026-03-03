import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.deutsia.pinfold',
	appName: 'Pinfold',
	webDir: 'build',
	server: {
		androidScheme: 'https'
	},
	plugins: {
		CapacitorHttp: {
			enabled: true
		},
		SplashScreen: {
			launchAutoHide: true,
			androidScaleType: 'CENTER_CROP',
			showSpinner: false,
			backgroundColor: '#0a0a0a'
		},
		StatusBar: {
			overlaysWebView: false
		}
	}
};

export default config;
