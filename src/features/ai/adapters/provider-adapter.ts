import { createOpenaiChatCompletions } from "@tanstack/ai-openai";
import type { ProviderConfig } from "../../../lib/validation";

export function getAiAdapter(config: ProviderConfig) {
	const model = config.model as Parameters<
		typeof createOpenaiChatCompletions
	>[0];

	return createOpenaiChatCompletions(model, config.apiKey, {
		baseURL: config.baseUrl,
	});
}
