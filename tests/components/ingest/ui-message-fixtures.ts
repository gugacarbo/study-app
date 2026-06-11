import type { UIMessage } from "ai";

export function buildTextMessage(
	id: string,
	role: UIMessage["role"],
	text: string,
): UIMessage {
	return {
		id,
		role,
		parts: [{ type: "text", text }],
	};
}

type DynamicToolState =
	| "input-streaming"
	| "input-available"
	| "output-available"
	| "output-error"
	| "approval-requested"
	| "approval-responded"
	| "output-denied";

export function buildDynamicToolPart(options: {
	toolCallId: string;
	toolName: string;
	state: DynamicToolState;
	input?: unknown;
	output?: unknown;
	errorText?: string;
}): UIMessage["parts"][number] {
	return {
		type: "dynamic-tool",
		toolCallId: options.toolCallId,
		toolName: options.toolName,
		state: options.state,
		input: options.input ?? {},
		...(options.output !== undefined ? { output: options.output } : {}),
		...(options.errorText ? { errorText: options.errorText } : {}),
	} as UIMessage["parts"][number];
}

export function buildAssistantMessage(
	parts: UIMessage["parts"],
	messageId = "assistant-1",
): UIMessage {
	return {
		id: messageId,
		role: "assistant",
		parts,
	};
}
