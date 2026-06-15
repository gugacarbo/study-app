import {
	useExternalStoreRuntime,
	type AppendMessage,
	type ThreadMessageLike,
} from "@assistant-ui/react";
import type { ReadonlyJSONObject } from "assistant-stream/utils";
import type { UIMessage } from "ai";
import { getToolName, isToolUIPart } from "ai";
import { useCallback, useMemo } from "react";
import { mergeAssistantTurnMessages } from "@/features/ai/hooks/use-readonly-assistant-runtime";

interface UseFollowUpAssistantRuntimeOptions {
	messages: UIMessage[];
	isRunning?: boolean;
	composerEnabled?: boolean;
	onSend?: (text: string) => void | Promise<void>;
}

type ThreadContentPart = Exclude<ThreadMessageLike["content"], string>[number];

function safeJson(value: unknown): string {
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

function stringifyToolArgs(value: unknown): string {
	if (typeof value === "string") return value;
	return safeJson(value ?? {});
}

function mapMessageParts(parts: UIMessage["parts"]): ThreadContentPart[] {
	const content: ThreadContentPart[] = [];

	for (const part of parts) {
		if (part.type === "text") {
			const text = part.text.trim();
			if (text.length > 0) {
				content.push({ type: "text", text });
			}
			continue;
		}

		if (part.type === "reasoning") {
			const text = part.text.trim();
			if (text.length > 0) {
				content.push({ type: "reasoning", text });
			}
			continue;
		}

		if (isToolUIPart(part)) {
			const toolName = getToolName(part);
			const argsText = stringifyToolArgs(part.input);
			let result: unknown;
			let isError = false;

			if (part.state === "output-available") {
				result = part.output;
			} else if (part.state === "output-error") {
				isError = true;
				result = { error: part.errorText };
			} else if (part.state === "output-denied") {
				isError = true;
				result = { error: part.errorText ?? "Tool approval denied" };
			}

			content.push({
				type: "tool-call",
				toolCallId: part.toolCallId,
				toolName,
				argsText,
				args:
					part.input != null &&
					typeof part.input === "object" &&
					!Array.isArray(part.input)
						? (part.input as ReadonlyJSONObject)
						: ({} as ReadonlyJSONObject),
				result,
				isError,
			});
		}
	}

	return content;
}

function convertUIMessageToThreadMessageLike(
	message: UIMessage,
	options?: { isPending?: boolean },
): ThreadMessageLike {
	return {
		id: message.id,
		role: message.role,
		content: mapMessageParts(message.parts),
		...(message.role === "assistant" && {
			status: options?.isPending
				? ({ type: "running" } as const)
				: ({ type: "complete", reason: "stop" } as const),
		}),
	};
}

function readAppendMessageText(message: AppendMessage): string {
	return message.content
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("")
		.trim();
}

export function useFollowUpAssistantRuntime({
	messages,
	isRunning = false,
	composerEnabled = false,
	onSend,
}: UseFollowUpAssistantRuntimeOptions) {
	const mergedMessages = useMemo(
		() => mergeAssistantTurnMessages(messages),
		[messages],
	);

	const handleNew = useCallback(
		async (message: AppendMessage) => {
			if (!composerEnabled || !onSend) return;
			const text = readAppendMessageText(message);
			if (text.length === 0) return;
			await onSend(text);
		},
		[composerEnabled, onSend],
	);

	const store = useMemo(
		() => ({
			messages: mergedMessages,
			isRunning,
			isDisabled: !composerEnabled,
			isSendDisabled: isRunning || !composerEnabled,
			convertMessage: (message: UIMessage, index: number) =>
				convertUIMessageToThreadMessageLike(message, {
					isPending:
						isRunning &&
						index === mergedMessages.length - 1 &&
						message.role === "assistant",
				}),
			onNew: handleNew,
		}),
		[mergedMessages, isRunning, composerEnabled, handleNew],
	);

	return useExternalStoreRuntime(store);
}
