import { createOpenAI } from "@ai-sdk/openai";
import type { ProviderConfig, RequestParams } from "@/lib/validation";

function hasRequestParams(requestParams: RequestParams | null | undefined): boolean {
	return Boolean(requestParams && Object.keys(requestParams).length > 0);
}

export function injectModelRequestBody(
	body: BodyInit | null | undefined,
	config: Pick<ProviderConfig, "thinkingEnabled" | "requestParams">,
): BodyInit | null | undefined {
	const needsThinking = config.thinkingEnabled != null;
	const needsParams = hasRequestParams(config.requestParams);

	if ((!needsThinking && !needsParams) || typeof body !== "string") {
		return body;
	}

	try {
		const parsed = JSON.parse(body);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return body;
		}

		return JSON.stringify({
			...(needsParams ? config.requestParams : {}),
			...parsed,
			...(needsThinking ? { thinking: config.thinkingEnabled } : {}),
		});
	} catch {
		return body;
	}
}

/** @deprecated Use injectModelRequestBody */
export function injectThinkingIntoBody(
	body: BodyInit | null | undefined,
	thinkingEnabled: boolean | null | undefined,
): BodyInit | null | undefined {
	return injectModelRequestBody(body, { thinkingEnabled });
}

function needsCustomFetch(config: ProviderConfig): boolean {
	return (
		config.thinkingEnabled != null || hasRequestParams(config.requestParams)
	);
}

export function getAiModel(config: ProviderConfig) {
	const openai = createOpenAI({
		apiKey: config.apiKey,
		baseURL: config.baseUrl,
		fetch: needsCustomFetch(config)
			? (input, init) =>
					fetch(input, {
						...init,
						body: injectModelRequestBody(init?.body, config),
					})
			: undefined,
	});

	return openai(config.model);
}
