import {
	type AppendMessage,
	useExternalStoreRuntime,
} from "@assistant-ui/react";
import type { UIMessage } from "ai";
import { useCallback, useMemo } from "react";
import {
	convertUIMessageToThreadMessageLike,
	mergeAssistantTurnMessages,
} from "./convert-ui-message";

export type PipelineAssistantMode = "readonly" | "follow-up";

interface UsePipelineAssistantRuntimeOptions {
	messages: UIMessage[];
	isRunning?: boolean;
	mode: PipelineAssistantMode;
	composerEnabled?: boolean;
	onSend?: (text: string) => void | Promise<void>;
}

function readAppendMessageText(message: AppendMessage): string {
	return message.content
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("")
		.trim();
}

export function usePipelineAssistantRuntime({
	messages,
	isRunning = false,
	mode,
	composerEnabled = false,
	onSend,
}: UsePipelineAssistantRuntimeOptions) {
	const mergedMessages = useMemo(
		() => mergeAssistantTurnMessages(messages),
		[messages],
	);

	const handleNew = useCallback(
		async (message: AppendMessage) => {
			if (mode !== "follow-up" || !composerEnabled || !onSend) return;
			const text = readAppendMessageText(message);
			if (text.length === 0) return;
			await onSend(text);
		},
		[mode, composerEnabled, onSend],
	);

	const store = useMemo(() => {
		const isReadonly = mode === "readonly";
		const canCompose = mode === "follow-up" && composerEnabled;

		return {
			messages: mergedMessages,
			isRunning,
			isDisabled: isReadonly || !canCompose,
			isSendDisabled: isRunning || !canCompose,
			convertMessage: (message: UIMessage, index: number) =>
				convertUIMessageToThreadMessageLike(message, {
					isPending:
						isRunning &&
						index === mergedMessages.length - 1 &&
						message.role === "assistant",
				}),
			onNew: isReadonly ? async () => {} : handleNew,
		};
	}, [mergedMessages, isRunning, mode, composerEnabled, handleNew]);

	return useExternalStoreRuntime(store);
}
