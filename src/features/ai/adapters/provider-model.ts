import { createOpenAI } from "@ai-sdk/openai";
import type { ProviderConfig } from "@/lib/validation";

export function getAiModel(config: ProviderConfig) {
	const openai = createOpenAI({
		apiKey: config.apiKey,
		baseURL: config.baseUrl,
	});

	return openai(config.model);
}
