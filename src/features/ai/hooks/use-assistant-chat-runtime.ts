import type { AppendMessage } from "@assistant-ui/react";
import { useExternalStoreRuntime } from "@assistant-ui/react";
import type { ChatClient } from "@tanstack/ai-client";
import { useSelector } from "@tanstack/react-store";
import { useMemo, useRef } from "react";
import { convertUIMessageToThreadMessageLike } from "@/features/ai/adapters/tanstack-message-adapter";
import { chatStore } from "@/features/ai/stores/chat-store";

interface UseAssistantChatRuntimeOptions {
	chatClient: ChatClient | null;
	reviewMode: boolean;
	pendingSendStartedAtRef: React.MutableRefObject<number | null>;
}

export function useAssistantChatRuntime({
	chatClient,
	reviewMode,
	pendingSendStartedAtRef,
}: UseAssistantChatRuntimeOptions) {
	const messages = useSelector(chatStore, (state) => state.messages);
	const isLoading = useSelector(chatStore, (state) => state.isLoading);
	const reviewModeRef = useRef(reviewMode);
	reviewModeRef.current = reviewMode;
	const chatClientRef = useRef(chatClient);
	chatClientRef.current = chatClient;

	const store = useMemo(
		() => ({
			messages,
			isRunning: isLoading,
			convertMessage: (message: (typeof messages)[number], index: number) =>
				convertUIMessageToThreadMessageLike(message, {
					isPending:
						isLoading &&
						index === messages.length - 1 &&
						message.role === "assistant",
				}),
			onNew: async (message: AppendMessage) => {
				const text = getAppendMessageText(message).trim();
				const client = chatClientRef.current;
				if (!text || !client || client.getIsLoading()) return;
				pendingSendStartedAtRef.current = Date.now();
				await client.sendMessage(text, {
					reviewMode: reviewModeRef.current,
				});
			},
			onCancel: async () => {
				chatClientRef.current?.stop();
			},
		}),
		[messages, isLoading, pendingSendStartedAtRef],
	);

	return useExternalStoreRuntime(store);
}

function getAppendMessageText(message: AppendMessage): string {
	if (typeof message.content === "string") {
		return message.content;
	}

	return message.content
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("\n\n");
}
