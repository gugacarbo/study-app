export type ModelProbeRequest = {
	modelRowId: string;
	savedModelId: string;
	testedModelId: string;
	displayName: string;
	providerName: string;
	providerBaseUrl: string;
	prompt: string;
	maxOutputTokens: number;
	timeoutMs: number;
	reasoningEffort?: string | null;
};

export type ModelProbeResponse = {
	ok: boolean;
	text?: string;
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	};
	finishReason?: string;
	error?: string;
	statusCode?: number;
	url?: string;
	responseBody?: string;
};

export type ModelProbeHttp = {
	request?: {
		method: string;
		url: string;
		headers: Record<string, string>;
		body?: string;
	};
	response?: {
		status: number;
		statusText?: string;
		headers: Record<string, string>;
		body?: string;
	};
};

export type ModelProbeResult = {
	ok: boolean;
	request: ModelProbeRequest;
	response: ModelProbeResponse;
	http?: ModelProbeHttp;
};
