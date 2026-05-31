import { createOpenaiChatCompletions } from "@tanstack/ai-openai";
import type { ProviderConfig } from "../../../lib/validation";

export function getAiAdapter(config: ProviderConfig) {
	const baseURL =
		config.baseUrl ||
		(config.provider === "openrouter"
			? "https://openrouter.ai/api/v1"
			: undefined);

	const model = config.model as Parameters<
		typeof createOpenaiChatCompletions
	>[0];

	return createOpenaiChatCompletions(model, config.apiKey, {
		baseURL,
	});
}
