import type { ThreadMessageLike } from "@assistant-ui/react";
import type { UIMessage } from "@tanstack/ai-client";

type UIMessagePart = UIMessage["parts"][number];
type ToolCallPart = Extract<UIMessagePart, { type: "tool-call" }>;
type ToolResultPart = Extract<UIMessagePart, { type: "tool-result" }>;

export type ParsedPart =
	| { type: "text"; content: string }
	| { type: "think"; content: string; incomplete?: boolean };

type ThreadContentPart = Exclude<ThreadMessageLike["content"], string>[number];

function parseTextParts(content: string): ParsedPart[] {
	const parts: ParsedPart[] = [];
	const openTag = "<think>";
	const closeTag = "</think>";
	let cursor = 0;

	while (cursor < content.length) {
		const openIndex = content.indexOf(openTag, cursor);
		if (openIndex === -1) {
			const tail = content.slice(cursor).trim();
			if (tail) parts.push({ type: "text", content: tail });
			break;
		}

		if (openIndex > cursor) {
			const text = content.slice(cursor, openIndex).trim();
			if (text) parts.push({ type: "text", content: text });
		}

		const thinkStart = openIndex + openTag.length;
		const closeIndex = content.indexOf(closeTag, thinkStart);
		if (closeIndex === -1) {
			const dangling = content.slice(thinkStart).trim();
			if (dangling) {
				parts.push({ type: "think", content: dangling, incomplete: true });
			}
			break;
		}

		const thinkContent = content.slice(thinkStart, closeIndex).trim();
		if (thinkContent) {
			parts.push({ type: "think", content: thinkContent });
		}
		cursor = closeIndex + closeTag.length;
	}

	return parts.length > 0 ? parts : [{ type: "text", content }];
}

function firstToolCallPartIndex(parts: UIMessage["parts"]): number {
	return parts.findIndex((part) => part.type === "tool-call");
}

function thinkingOnlyTextResponse(parsed: ParsedPart[]): string | undefined {
	const responseText = parsed
		.filter((segment) => segment.type === "think")
		.map((segment) => segment.content.trim())
		.filter(Boolean)
		.join("\n\n");

	return responseText.length > 0 ? responseText : undefined;
}

export function expandAssistantMessageParts(
	parts: UIMessage["parts"],
): UIMessage["parts"] {
	const expanded: UIMessage["parts"] = [];
	const firstToolIndex = firstToolCallPartIndex(parts);

	for (let index = 0; index < parts.length; index += 1) {
		const part = parts[index];
		if (!part) continue;

		if (part.type === "thinking") {
			if ((part.content ?? "").trim().length > 0) {
				expanded.push(part);
			}
			continue;
		}

		if (part.type !== "text") {
			expanded.push(part);
			continue;
		}

		const content = part.content ?? "";
		if (content.trim().length === 0) {
			expanded.push(part);
			continue;
		}

		const parsed = parseTextParts(content);
		const hasEmbeddedThinking = parsed.some(
			(segment) => segment.type === "think",
		);

		if (!hasEmbeddedThinking) {
			expanded.push(part);
			continue;
		}

		let hasVisibleText = false;
		for (const segment of parsed) {
			if (segment.type === "think") {
				const thinkContent = segment.content.trim();
				if (thinkContent.length > 0) {
					expanded.push({ type: "thinking", content: thinkContent });
				}
				continue;
			}

			const textContent = segment.content.trim();
			if (textContent.length > 0) {
				hasVisibleText = true;
				expanded.push({ type: "text", content: textContent });
			}
		}

		if (!hasVisibleText && firstToolIndex !== -1 && index > firstToolIndex) {
			const responseText = thinkingOnlyTextResponse(parsed);
			if (responseText) {
				expanded.push({ type: "text", content: responseText });
			}
		}
	}

	return expanded;
}

/**
 * ChatClient auto-continuation creates a new assistant UIMessage per tool
 * iteration. Merge those into one virtual message for assistant-ui rendering.
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

export function safeJson(value: unknown): string {
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

function formatToolResultContent(value: unknown): string | undefined {
	if (value == null) return undefined;

	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}

	return safeJson(value);
}

function toolResultFromCallOutput(
	toolCall: ToolCallPart,
): ToolResultPart | undefined {
	if (toolCall.output == null) return undefined;

	const content = formatToolResultContent(toolCall.output);
	if (!content) return undefined;

	return {
		type: "tool-result",
		toolCallId: toolCall.id,
		content,
		state: "complete",
	};
}

function mapToolCallPart(
	toolCall: ToolCallPart,
	toolResults: Map<string, ToolResultPart>,
	consumedResultIds: Set<string>,
): ThreadContentPart {
	const pairedResult =
		toolResults.get(toolCall.id) ?? toolResultFromCallOutput(toolCall);
	if (pairedResult) {
		consumedResultIds.add(pairedResult.toolCallId);
	}

	const argsText =
		typeof toolCall.arguments === "string"
			? toolCall.arguments
			: safeJson(toolCall.arguments ?? {});

	return {
		type: "tool-call",
		toolCallId: toolCall.id,
		toolName: String(toolCall.name ?? "tool"),
		argsText,
		result: pairedResult?.content,
		isError: pairedResult?.error != null,
	};
}

function mapMessageParts(parts: UIMessage["parts"]): ThreadContentPart[] {
	const expanded = expandAssistantMessageParts(parts);
	const toolResults = new Map<string, ToolResultPart>();
	const consumedResultIds = new Set<string>();

	for (const part of expanded) {
		if (part.type === "tool-result") {
			toolResults.set(part.toolCallId, part);
		}
	}

	const content: ThreadContentPart[] = [];

	for (const part of expanded) {
		if (part.type === "text") {
			const text = (part.content ?? "").trim();
			if (text.length > 0) {
				content.push({ type: "text", text });
			}
			continue;
		}

		if (part.type === "thinking") {
			const text = (part.content ?? "").trim();
			if (text.length > 0) {
				content.push({ type: "reasoning", text });
			}
			continue;
		}

		if (part.type === "tool-call") {
			content.push(mapToolCallPart(part, toolResults, consumedResultIds));
			continue;
		}

		if (part.type === "tool-result") {
			if (consumedResultIds.has(part.toolCallId)) continue;
			content.push({
				type: "tool-call",
				toolCallId: part.toolCallId,
				toolName: "tool-result",
				argsText: "{}",
				result: part.content,
				isError: part.error != null,
			});
		}
	}

	return content;
}

export function convertUIMessageToThreadMessageLike(
	message: UIMessage,
	options?: { isPending?: boolean },
): ThreadMessageLike {
	const content = mapMessageParts(message.parts);

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

export function toThreadMessages(
	messages: UIMessage[],
	options?: { isRunning?: boolean },
): ThreadMessageLike[] {
	const merged = mergeAssistantTurnMessages(messages);

	return merged.map((message, index) =>
		convertUIMessageToThreadMessageLike(message, {
			isPending:
				options?.isRunning === true &&
				index === merged.length - 1 &&
				message.role === "assistant",
		}),
	);
}
