export type ModelProbeRequest = {
	modelRowId: string;
	savedModelId: string;
	testedModelId: string;
	displayName: string;
	providerName: string;
	providerBaseUrl: string;
	prompt: string;
	maxOutputTokens: number;
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

export type ModelProbeResult = {
	ok: boolean;
	request: ModelProbeRequest;
	response: ModelProbeResponse;
};
