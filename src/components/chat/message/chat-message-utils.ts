import type { UIMessage } from "@tanstack/ai-client";

export interface AssistantPerfMetrics {
	ttftMs: number;
	tokensPerSecond: number;
	isStreaming: boolean;
	inputTokens?: number;
	outputTokens?: number;
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

export function bubbleMarkdownClass(role: UIMessage["role"]): string {
	if (role === "user") {
		return "prose-invert [&_a]:text-primary-foreground [&_a]:opacity-90 [&_blockquote]:border-primary-foreground/30 [&_code]:bg-primary-foreground/20";
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
