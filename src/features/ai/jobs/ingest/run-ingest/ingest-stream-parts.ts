export type IngestStreamPartEvent =
	| { type: "reasoning-delta"; messageId: string; delta: string }
	| { type: "reasoning"; messageId: string; text: string }
	| {
			type: "tool-call";
			messageId: string;
			toolCallId: string;
			toolName: string;
			argsText: string;
			state: "running";
	  }
	| {
			type: "tool-result";
			messageId: string;
			toolCallId: string;
			result: unknown;
			isError?: boolean;
	  }
	| { type: "text"; messageId: string; text: string };

export const REASONING_THROTTLE_MS = 300;

export function buildIngestStepMessageId(step: number): string {
	return `ingest-step-${step}`;
}

export function buildReasoningDeltaPart(
	messageId: string,
	delta: string,
): Extract<IngestStreamPartEvent, { type: "reasoning-delta" }> {
	return { type: "reasoning-delta", messageId, delta };
}

export function buildReasoningPart(
	messageId: string,
	text: string,
): Extract<IngestStreamPartEvent, { type: "reasoning" }> {
	return { type: "reasoning", messageId, text };
}

export function buildStreamToolCallPart(input: {
	messageId: string;
	toolCallId: string;
	toolName: string;
	argsText: string;
}): Extract<IngestStreamPartEvent, { type: "tool-call" }> {
	return {
		type: "tool-call",
		messageId: input.messageId,
		toolCallId: input.toolCallId,
		toolName: input.toolName,
		argsText: input.argsText,
		state: "running",
	};
}

export function buildStreamToolResultPart(input: {
	messageId: string;
	toolCallId: string;
	result: unknown;
	isError?: boolean;
}): Extract<IngestStreamPartEvent, { type: "tool-result" }> {
	return {
		type: "tool-result",
		messageId: input.messageId,
		toolCallId: input.toolCallId,
		result: input.result,
		...(input.isError ? { isError: true } : {}),
	};
}

export function buildStreamTextPart(
	messageId: string,
	text: string,
): Extract<IngestStreamPartEvent, { type: "text" }> {
	return { type: "text", messageId, text };
}

export function serializeIngestStreamPart(part: IngestStreamPartEvent): string {
	return JSON.stringify(part);
}
