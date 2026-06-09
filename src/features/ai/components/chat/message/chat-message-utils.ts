import type { UIMessage } from "@tanstack/ai-client";

export interface AssistantPerfMetrics {
	ttftMs: number;
	tokensPerSecond: number;
	isStreaming: boolean;
	inputTokens?: number;
	outputTokens?: number;
	/** Epoch ms when the response completed */
	respondedAt?: number;
	/** Total ms from user message sent to response complete */
	totalResponseMs?: number;
}

export type ParsedPart =
	| { type: "text"; content: string }
	| { type: "think"; content: string; incomplete?: boolean };

export type DetailTriggerTone =
	| "neutral"
	| "success"
	| "error"
	| "progress"
	| "approval";

export type ToolCallViewModel = {
	name?: unknown;
	arguments?: unknown;
	input?: unknown;
	output?: unknown;
	state?: unknown;
};

export type ToolResultViewModel = {
	state?: unknown;
	content?: unknown;
	error?: unknown;
};

export function parseTextParts(content: string): ParsedPart[] {
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

export function expandAssistantMessageParts(
	parts: UIMessage["parts"],
): UIMessage["parts"] {
	const expanded: UIMessage["parts"] = [];

	for (const part of parts) {
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
				expanded.push({ type: "text", content: textContent });
			}
		}
	}

	return expanded;
}

const USER_BUBBLE_MARKDOWN_CLASS =
	"prose prose-sm max-w-none text-inherit prose-p:my-0 prose-p:leading-relaxed prose-headings:my-1 prose-ul:my-0.5 prose-ol:my-0.5 prose-li:my-0 prose-code:before:content-none prose-code:after:content-none [&_code]:rounded [&_code]:bg-primary-foreground/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_a]:text-primary-foreground/90 [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-primary-foreground/25 [&_blockquote]:text-primary-foreground/80";

export function bubbleMarkdownClass(role: UIMessage["role"]): string {
	if (role === "user") {
		return USER_BUBBLE_MARKDOWN_CLASS;
	}
	return "";
}

export function safeJson(value: unknown): string {
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

export function formatToolPayload(value: unknown): string | undefined {
	if (value == null) return undefined;

	if (typeof value === "string") {
		const trimmed = value.trim();
		if (trimmed.length === 0 || trimmed === "{}" || trimmed === "[]") {
			return undefined;
		}

		try {
			return safeJson(JSON.parse(trimmed));
		} catch {
			return trimmed;
		}
	}

	if (Array.isArray(value)) {
		return value.length > 0 ? safeJson(value) : undefined;
	}

	if (typeof value === "object") {
		return Object.keys(value as Record<string, unknown>).length > 0
			? safeJson(value)
			: undefined;
	}

	return String(value);
}

export function labelForToolState(state: unknown): string {
	switch (state) {
		case "awaiting-input":
			return "awaiting input";
		case "input-streaming":
			return "input streaming";
		case "input-complete":
			return "input complete";
		case "approval-requested":
			return "approval requested";
		case "approval-responded":
			return "approval responded";
		case "streaming":
			return "streaming";
		case "complete":
		case "completed":
			return "complete";
		case "error":
			return "error";
		default:
			return "unknown";
	}
}

export function triggerToneClass(tone: DetailTriggerTone): string {
	switch (tone) {
		case "success":
			return "emerald-400";
		case "error":
			return "red-400";
		case "progress":
			return "sky-400";
		case "approval":
			return "violet-400";
		default:
			return "muted-foreground";
	}
}

export function toneFromState(state: string): DetailTriggerTone {
	if (state === "complete") return "success";
	if (state === "error") return "error";
	if (state === "streaming" || state === "input-streaming") return "progress";
	if (state === "approval-requested" || state === "approval-responded") {
		return "approval";
	}
	return "neutral";
}

export function isLoadingToolState(state: unknown): boolean {
	return (
		state === "awaiting-input" ||
		state === "input-streaming" ||
		state === "streaming"
	);
}

type AssistantMessagePart = UIMessage["parts"][number];
type AssistantToolCallPart = Extract<AssistantMessagePart, { type: "tool-call" }>;
type AssistantToolResultPart = Extract<
	AssistantMessagePart,
	{ type: "tool-result" }
>;

export type GroupedAgentMessagePart =
	| { kind: "single"; part: AssistantMessagePart; index: number }
	| {
			kind: "tool-call";
			toolCall: AssistantToolCallPart;
			toolResult?: AssistantToolResultPart;
			index: number;
	  };

export function hasVisibleAssistantContent(parts: UIMessage["parts"]): boolean {
	return parts.some((part) => {
		if (part.type === "text" || part.type === "thinking") {
			return (part.content ?? "").trim().length > 0;
		}
		return true;
	});
}

export function shouldShowAssistantThinkingPlaceholder(
	parts: UIMessage["parts"],
	isPending: boolean,
): boolean {
	return isPending && !hasVisibleAssistantContent(parts);
}

export function resolveThinkingIsPending(
	partIndex: number,
	parts: UIMessage["parts"],
	messageIsPending: boolean,
): boolean {
	if (!messageIsPending) return false;
	return parts.slice(partIndex + 1).length === 0;
}

export function groupAssistantMessageParts(
	parts: UIMessage["parts"],
): GroupedAgentMessagePart[] {
	const resultsByCallId = new Map<string, AssistantToolResultPart>();
	const consumedResultIds = new Set<string>();

	for (const part of parts) {
		if (part.type === "tool-result") {
			resultsByCallId.set(part.toolCallId, part);
		}
	}

	const grouped: GroupedAgentMessagePart[] = [];

	for (let index = 0; index < parts.length; index += 1) {
		const part = parts[index];

		if (part.type === "tool-call") {
			const toolResult = resultsByCallId.get(part.id);
			if (toolResult) {
				consumedResultIds.add(toolResult.toolCallId);
			}

			grouped.push({
				kind: "tool-call",
				toolCall: part,
				toolResult,
				index,
			});
			continue;
		}

		if (part.type === "tool-result") {
			if (consumedResultIds.has(part.toolCallId)) {
				continue;
			}

			grouped.push({ kind: "single", part, index });
			continue;
		}

		grouped.push({ kind: "single", part, index });
	}

	return grouped;
}

export type AgentWorkBlock = {
	kind: "agent-work";
	parts: GroupedAgentMessagePart[];
};

export type RenderableAssistantBlock =
	| AgentWorkBlock
	| { kind: "content"; groupedPart: GroupedAgentMessagePart };

export function isAgentWorkPart(
	groupedPart: GroupedAgentMessagePart,
): boolean {
	if (groupedPart.kind === "tool-call") return true;
	return groupedPart.part.type === "thinking";
}

export function isAgentWorkRunComplete(
	parts: GroupedAgentMessagePart[],
): boolean {
	for (const part of parts) {
		if (part.kind !== "tool-call") continue;

		const presentation = resolveToolCallTriggerPresentation(
			part.toolCall,
			part.toolResult,
		);
		if (presentation.isLoading) return false;
	}

	return true;
}

export function shouldGroupAgentWorkRun(
	parts: GroupedAgentMessagePart[],
	options: { isPending: boolean },
): boolean {
	if (options.isPending) return false;
	if (parts.length < 2) return false;
	return isAgentWorkRunComplete(parts);
}

export function groupAgentWorkSections(
	groupedParts: GroupedAgentMessagePart[],
	options?: { isPending?: boolean },
): RenderableAssistantBlock[] {
	const isPending = options?.isPending ?? false;
	const blocks: RenderableAssistantBlock[] = [];

	const emitWorkRun = (parts: GroupedAgentMessagePart[]) => {
		if (parts.length === 0) return;

		if (shouldGroupAgentWorkRun(parts, { isPending })) {
			blocks.push({ kind: "agent-work", parts });
			return;
		}

		for (const groupedPart of parts) {
			blocks.push({ kind: "content", groupedPart });
		}
	};

	let firstWorkIndex = -1;
	let lastWorkIndex = -1;
	for (let index = 0; index < groupedParts.length; index += 1) {
		if (isAgentWorkPart(groupedParts[index]!)) {
			if (firstWorkIndex === -1) firstWorkIndex = index;
			lastWorkIndex = index;
		}
	}

	if (firstWorkIndex === -1) {
		for (const groupedPart of groupedParts) {
			blocks.push({ kind: "content", groupedPart });
		}
		return blocks;
	}

	for (let index = 0; index < firstWorkIndex; index += 1) {
		blocks.push({ kind: "content", groupedPart: groupedParts[index]! });
	}

	const workParts: GroupedAgentMessagePart[] = [];
	for (let index = firstWorkIndex; index <= lastWorkIndex; index += 1) {
		const groupedPart = groupedParts[index]!;
		if (isAgentWorkPart(groupedPart)) {
			workParts.push(groupedPart);
		}
	}
	emitWorkRun(workParts);

	for (let index = lastWorkIndex + 1; index < groupedParts.length; index += 1) {
		blocks.push({ kind: "content", groupedPart: groupedParts[index]! });
	}

	return blocks;
}

export function buildRenderableAssistantBlocks(
	parts: UIMessage["parts"],
	options?: { isPending?: boolean },
): RenderableAssistantBlock[] {
	return groupAgentWorkSections(
		groupAssistantMessageParts(expandAssistantMessageParts(parts)),
		options,
	);
}

export function buildAgentWorkSummary(
	parts: GroupedAgentMessagePart[],
): string {
	const toolCount = parts.filter((part) => part.kind === "tool-call").length;
	if (toolCount === 0) return "Agent Work";
	if (toolCount === 1) return "Agent Work: 1 tool";
	return `Agent Work: ${toolCount} tools`;
}

export function resolveAgentWorkPresentation(parts: GroupedAgentMessagePart[]): {
	tone: DetailTriggerTone;
	isLoading: boolean;
	defaultOpen: boolean;
} {
	let hasLoading = false;
	let hasError = false;
	let hasToolCall = false;
	let allToolsComplete = true;

	for (const part of parts) {
		if (part.kind !== "tool-call") continue;

		hasToolCall = true;
		const presentation = resolveToolCallTriggerPresentation(
			part.toolCall,
			part.toolResult,
		);

		if (presentation.isLoading) hasLoading = true;
		if (presentation.tone === "error") hasError = true;
		if (presentation.tone !== "success") allToolsComplete = false;
	}

	if (hasError) {
		return { tone: "error", isLoading: false, defaultOpen: false };
	}
	if (hasLoading) {
		return { tone: "progress", isLoading: true, defaultOpen: true };
	}
	if (hasToolCall && allToolsComplete) {
		return { tone: "success", isLoading: false, defaultOpen: false };
	}
	return { tone: "neutral", isLoading: false, defaultOpen: false };
}

export function resolveToolCallTriggerPresentation(
	toolCall: ToolCallViewModel,
	toolResult?: ToolResultViewModel,
): { tone: DetailTriggerTone; isLoading: boolean } {
	if (toolResult) {
		const resultState =
			typeof toolResult.state === "string" ? toolResult.state : "unknown";
		return {
			tone: toneFromState(resultState),
			isLoading: isLoadingToolState(toolResult.state),
		};
	}

	if (toolCall.state === "input-complete") {
		return { tone: "progress", isLoading: true };
	}

	const callState =
		typeof toolCall.state === "string" ? toolCall.state : "unknown";
	return {
		tone: toneFromState(callState),
		isLoading: isLoadingToolState(toolCall.state),
	};
}
