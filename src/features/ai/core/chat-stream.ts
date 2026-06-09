import type { ChatMiddleware, ModelMessage } from "@tanstack/ai";
import { chat } from "@tanstack/ai";
import { getAiAdapter } from "@/features/ai/adapters/provider-adapter";
import type { ProviderConfig } from "@/lib/validation";
import {
	createIncrementalToolEventMiddleware,
	type AgentStreamHandlers,
} from "./agent-stream-handler";

export function streamChatMessages(
	config: ProviderConfig,
	messages: Array<ModelMessage>,
	options?: {
		abortController?: AbortController;
		system?: string;
		tools?: Parameters<typeof chat>[0]["tools"];
		middleware?: ChatMiddleware[];
		toolStreamHandlers?: Pick<
			AgentStreamHandlers,
			"onToolCall" | "onToolResult"
		>;
	},
) {
	const adapter = getAiAdapter(config);
	const middleware = [...(options?.middleware ?? [])];

	if (options?.toolStreamHandlers) {
		middleware.unshift(
			createIncrementalToolEventMiddleware(options.toolStreamHandlers),
		);
	}

	return chat({
		adapter,
		messages,
		systemPrompts: options?.system ? [options.system] : undefined,
		abortController: options?.abortController,
		tools: options?.tools,
		middleware: middleware.length > 0 ? middleware : undefined,
	});
}
