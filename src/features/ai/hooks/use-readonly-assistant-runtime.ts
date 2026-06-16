import {
	useExternalStoreRuntime,
	type ThreadMessageLike,
} from "@assistant-ui/react";
import type { ReadonlyJSONObject } from "assistant-stream/utils";
import type { UIMessage } from "ai";
import { getToolName, isToolUIPart } from "ai";
import { useMemo } from "react";

interface UseReadOnlyAssistantRuntimeOptions {
	messages: UIMessage[];
	isRunning?: boolean;
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

/**
 * Chat auto-continuation creates a new assistant UIMessage per tool iteration.
 * Merge those into one virtual message for assistant-ui rendering.
 */
export function mergeAssistantTurnMessages(messages: UIMessage[]): UIMessage[] {
	const merged: UIMessage[] = [];

	for (const message of messages) {
		if (message.role !== "assistant" || message.id === "welcome") {
			merged.push(message);
			continue;
		}

		const previous = merged[merged.length - 1];
		if (previous?.role === "assistant" && previous.id !== "welcome") {
			merged[merged.length - 1] = {
				...previous,
				parts: [...previous.parts, ...message.parts],
				id: message.id,
			};
			continue;
		}

		merged.push({ ...message });
	}

	return merged;
}

function readToolResultFromPart(part: {
	state: string;
	output?: unknown;
	errorText?: string;
}): {
	result: unknown;
	isError: boolean;
} {
	if (part.state === "output-available") {
		return { result: part.output, isError: false };
	}
	if (part.state === "output-error") {
		return { result: { error: part.errorText }, isError: true };
	}
	if (part.state === "output-denied") {
		return {
			result: { error: part.errorText ?? "Tool approval denied" },
			isError: true,
		};
	}
	if (part.output != null) {
		return { result: part.output, isError: false };
	}
	return { result: undefined, isError: false };
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
			const { result, isError } = readToolResultFromPart(part);

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

function getSystemMessageContent(parts: UIMessage["parts"]): string {
	return parts
		.filter((part): part is { type: "text"; text: string } => part.type === "text")
		.map((part) => part.text)
		.join("\n")
		.trim();
}

function convertUIMessageToThreadMessageLike(
	message: UIMessage,
	options?: { isPending?: boolean },
): ThreadMessageLike {
	const content =
		message.role === "system"
			? getSystemMessageContent(message.parts)
				: mapMessageParts(message.parts);

	return {
		id: message.id,
		role: message.role,
		content,
		...(message.role === "assistant" && {
			status: options?.isPending
				? ({ type: "running" } as const)
				: ({ type: "complete", reason: "stop" } as const),
		}),
	};
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
