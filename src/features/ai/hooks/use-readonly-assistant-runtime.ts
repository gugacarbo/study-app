import { useExternalStoreRuntime } from "@assistant-ui/react";
import type { UIMessage } from "@tanstack/ai-client";
import { useMemo } from "react";
import {
	convertUIMessageToThreadMessageLike,
	mergeAssistantTurnMessages,
} from "@/features/ai/adapters/tanstack-message-adapter";

interface UseReadOnlyAssistantRuntimeOptions {
	messages: UIMessage[];
	isRunning?: boolean;
}

export function useReadOnlyAssistantRuntime({
	messages,
	isRunning = false,
}: UseReadOnlyAssistantRuntimeOptions) {
	const mergedMessages = useMemo(
		() => mergeAssistantTurnMessages(messages),
		[messages],
	);

	const store = useMemo(
		() => ({
			messages: mergedMessages,
			isRunning,
			isDisabled: true,
			convertMessage: (message: UIMessage, index: number) =>
				convertUIMessageToThreadMessageLike(message, {
					isPending:
						isRunning &&
						index === mergedMessages.length - 1 &&
						message.role === "assistant",
				}),
			onNew: async () => {},
		}),
		[mergedMessages, isRunning],
	);

	return useExternalStoreRuntime(store);
}
