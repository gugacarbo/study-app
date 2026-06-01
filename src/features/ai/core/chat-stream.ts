import type { ModelMessage } from "@tanstack/ai";
import { chat } from "@tanstack/ai";
import { getAiAdapter } from "@/features/ai/adapters/provider-adapter";
import type { ProviderConfig } from "@/lib/validation";

export function streamChatMessages(
	config: ProviderConfig,
	messages: Array<ModelMessage>,
	options?: {
		abortController?: AbortController;
		system?: string;
		tools?: Parameters<typeof chat>[0]["tools"];
	},
) {
	const adapter = getAiAdapter(config);

	return chat({
		adapter,
		messages,
		systemPrompts: options?.system ? [options.system] : undefined,
		abortController: options?.abortController,
		tools: options?.tools,
	});
}
