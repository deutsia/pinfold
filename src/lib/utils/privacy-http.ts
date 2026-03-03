import { registerPlugin } from '@capacitor/core';

export interface PrivacyHttpPlugin {
	request(options: {
		url: string;
		method?: string;
		headers?: Record<string, string>;
		data?: string;
		responseType?: 'text' | 'blob';
	}): Promise<{
		status: number;
		headers: Record<string, string>;
		data: unknown;
	}>;
	saveToDownloads(options: {
		data: string;
		fileName: string;
		mimeType?: string;
	}): Promise<{ success: boolean; fileName: string }>;
}

export const PrivacyHttp = registerPlugin<PrivacyHttpPlugin>('PrivacyHttp');
