import type { UIMessage } from "ai";
import type { ImproveQuestionsAgentEvent } from "@/features/ai/agents/improve-questions/contracts";
import type { ImproveQuestionsAgentRunStatus } from "@/features/ai/agents/improve-questions/contracts";
import { pickRicherToolResultContent } from "@/features/ai/core/ai-stream-handler";

export interface AgentRunState {
	agentRunId: string;
	label: string;
	status: ImproveQuestionsAgentRunStatus;
	systemPrompt: string;
	userPrompt: string;
	outputText: string;
	messages: UIMessage[];
	error: string | null;
	warnings: string[];
}

export interface AgentRunTextChunkEvent {
	eventType: "text-chunk";
	agentRunId: string;
	text: string;
	kind?: "text" | "reasoning";
	timestamp?: number;
}

export type AgentRunReducerEvent =
	| ImproveQuestionsAgentEvent
	| AgentRunTextChunkEvent;

type AgentRole = "system" | "user" | "assistant";
type DynamicToolPart = Extract<
	UIMessage["parts"][number],
	{ type: "dynamic-tool" }
>;

function createTextPart(text: string) {
	return { type: "text" as const, text };
}

function createReasoningPart(text: string) {
	return { type: "reasoning" as const, text };
}

function createAgentMessage(
	agentRunId: string,
	role: AgentRole,
	content: string,
): UIMessage {
	return {
		id: `${agentRunId}:${role}`,
		role,
		parts: [createTextPart(content)],
	};
}

function createAgentMessages(
	agentRunId: string,
	systemPrompt: string,
	userPrompt: string,
	assistantText: string,
): UIMessage[] {
	const messages: UIMessage[] = [];
	if (systemPrompt) {
		messages.push(createAgentMessage(agentRunId, "system", systemPrompt));
	}
	if (userPrompt) {
		messages.push(createAgentMessage(agentRunId, "user", userPrompt));
	}
	messages.push(createAgentMessage(agentRunId, "assistant", assistantText));
	return messages;
}

function getAssistantMessageIndex(messages: UIMessage[]): number {
	return messages.findIndex((message) => message.role === "assistant");
}

function stripStructuredToolTranscript(text: string): string {
	const markerIndex = text.indexOf("TOOL CALL:");
	if (markerIndex === -1) return text;

	const lineStart = text.lastIndexOf("\n", markerIndex);
	const cutIndex = lineStart === -1 ? markerIndex : lineStart;
	return text.slice(0, cutIndex).trimEnd();
}

function stripToolTranscriptFromTextParts(
	parts: UIMessage["parts"],
): UIMessage["parts"] {
	let didStrip = false;

	return parts
		.map((part) => {
			if (part.type !== "text" || didStrip) return part;
			const text = part.text;
			const strippedContent = stripStructuredToolTranscript(text);
			if (strippedContent === text) return part;
			didStrip = true;
			return { ...part, text: strippedContent };
		})
		.filter((part, index, allParts) => {
			if (part.type !== "text") return true;
			if (part.text.length > 0) return true;
			return (
				allParts.some((candidate) => candidate.type !== "text") || index !== 0
			);
		});
}

function hasMeaningfulAssistantParts(parts: UIMessage["parts"]): boolean {
	return parts.some((part) =>
		part.type === "text" ? part.text.length > 0 : true,
	);
}

function updateTrailingTextPart(
	parts: UIMessage["parts"],
	chunk: string,
): UIMessage["parts"] {
	const nextParts = [...parts];
	const lastPart = nextParts.at(-1);

	if (lastPart?.type === "text") {
		nextParts[nextParts.length - 1] = {
			...lastPart,
			text: `${lastPart.text}${chunk}`,
		};
		return nextParts;
	}

	return [...nextParts, createTextPart(chunk)];
}

function updateTrailingReasoningPart(
	parts: UIMessage["parts"],
	chunk: string,
): UIMessage["parts"] {
	const nextParts = [...parts];
	const lastPart = nextParts.at(-1);

	if (lastPart?.type === "reasoning") {
		nextParts[nextParts.length - 1] = {
			...lastPart,
			text: `${lastPart.text}${chunk}`,
		};
		return nextParts;
	}

	return [...nextParts, createReasoningPart(chunk)];
}

function upsertMessageText(
	agentRunId: string,
	messages: UIMessage[],
	role: AgentRole,
	content: string,
): UIMessage[] {
	const messageIndex = messages.findIndex((message) => message.role === role);
	if (messageIndex === -1) {
		const newMessage = createAgentMessage(agentRunId, role, content);
		if (role === "assistant") {
			return [...messages, newMessage];
		}

		const assistantIndex = messages.findIndex(
			(message) => message.role === "assistant",
		);
		if (role === "system") {
			const nextMessages = [...messages];
			nextMessages.splice(0, 0, newMessage);
			return nextMessages;
		}

		const systemIndex = messages.findIndex(
			(message) => message.role === "system",
		);
		const insertAt =
			systemIndex === -1
				? assistantIndex === -1
					? messages.length
					: assistantIndex
				: systemIndex + 1;
		const nextMessages = [...messages];
		nextMessages.splice(insertAt, 0, newMessage);
		return nextMessages;
	}

	const nextMessages = [...messages];
	const currentParts = nextMessages[messageIndex].parts;
	const nextParts = currentParts.some((part) => part.type === "text")
		? currentParts.map((part, index) =>
				part.type === "text" &&
				index ===
					currentParts.findIndex((candidate) => candidate.type === "text")
					? { ...part, text: content }
					: part,
			)
		: [createTextPart(content), ...currentParts];
	nextMessages[messageIndex] = {
		...nextMessages[messageIndex],
		parts: nextParts,
	};
	return nextMessages;
}

function ensureAgentRunMessages(state: AgentRunState): AgentRunState {
	if (state.messages.length > 0) {
		return state;
	}
	return {
		...state,
		messages: createAgentMessages(
			state.agentRunId,
			state.systemPrompt,
			state.userPrompt,
			state.outputText,
		),
	};
}

function withAssistantMessage(
	state: AgentRunState,
	update: (message: UIMessage) => UIMessage,
): AgentRunState {
	const normalizedState = ensureAgentRunMessages(state);
	const messageIndex = getAssistantMessageIndex(normalizedState.messages);
	if (messageIndex === -1) return normalizedState;

	const nextMessages = [...normalizedState.messages];
	nextMessages[messageIndex] = update(nextMessages[messageIndex]);

	return {
		...normalizedState,
		messages: nextMessages,
	};
}

function appendAssistantTextMessage(
	state: AgentRunState,
	chunk: string,
): AgentRunState {
	return withAssistantMessage(state, (message) => {
		const baseParts = hasMeaningfulAssistantParts(message.parts)
			? message.parts
			: [];

		return {
			...message,
			parts: updateTrailingTextPart(baseParts, chunk),
		};
	});
}

function appendAssistantThinkingMessage(
	state: AgentRunState,
	chunk: string,
): AgentRunState {
	return withAssistantMessage(state, (message) => {
		const baseParts = hasMeaningfulAssistantParts(message.parts)
			? message.parts
			: [];

		return {
			...message,
			parts: updateTrailingReasoningPart(baseParts, chunk),
		};
	});
}

function readAssistantText(messages: UIMessage[]): string {
	const assistant = messages.find((message) => message.role === "assistant");
	if (!assistant) return "";
	return assistant.parts
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("");
}

function syncPromptsIntoMessages(state: AgentRunState): AgentRunState {
	const nextState = ensureAgentRunMessages(state);
	const withSystem = upsertMessageText(
		nextState.agentRunId,
		nextState.messages,
		"system",
		nextState.systemPrompt,
	);
	const withUser = upsertMessageText(
		nextState.agentRunId,
		withSystem,
		"user",
		nextState.userPrompt,
	);
	const assistantText =
		nextState.outputText.length > 0
			? nextState.outputText
			: readAssistantText(nextState.messages);
	const assistantMessage = withUser.find(
		(message) => message.role === "assistant",
	);

	return {
		...nextState,
		messages:
			assistantMessage && hasMeaningfulAssistantParts(assistantMessage.parts)
				? withUser
				: upsertMessageText(
						nextState.agentRunId,
						withUser,
						"assistant",
						assistantText,
					),
	};
}

function safeJsonString(value: unknown): string {
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

function normalizeDynamicToolInputState(
	value: unknown,
): Extract<DynamicToolPart["state"], `input${string}` | `approval${string}`> {
	switch (value) {
		case "input-streaming":
		case "input-available":
		case "approval-requested":
		case "approval-responded":
			return value;
		case "awaiting-input":
		case "input-complete":
			return "input-available";
		default:
			return "input-available";
	}
}

function normalizeDynamicToolOutputState(
	value: unknown,
	error?: string,
): Extract<
	DynamicToolPart["state"],
	`output${string}` | "input-available"
> {
	if (typeof error === "string" && error.length > 0) {
		return "output-error";
	}
	switch (value) {
		case "output-available":
		case "output-error":
		case "output-denied":
			return value;
		case "streaming":
		case "complete":
		case "completed":
			return "output-available";
		case "error":
			return "output-error";
		default:
			return "output-available";
	}
}

function readLatestToolCallId(state: AgentRunState): string | undefined {
	const normalizedState = ensureAgentRunMessages(state);
	const assistant = normalizedState.messages.find(
		(message) => message.role === "assistant",
	);
	if (!assistant) return undefined;

	for (let index = assistant.parts.length - 1; index >= 0; index -= 1) {
		const part = assistant.parts[index];
		if (part.type === "dynamic-tool") {
			return part.toolCallId;
		}
	}

	return undefined;
}

function createToolCallId(
	state: AgentRunState,
	event: ImproveQuestionsAgentEvent,
): string {
	const meta = event.meta as Record<string, unknown> | undefined;
	const candidate = meta?.toolCallId ?? meta?.id;
	if (typeof candidate === "string" && candidate.length > 0) {
		return candidate;
	}

	const existingCount = ensureAgentRunMessages(state)
		.messages.find((message) => message.role === "assistant")
		?.parts.filter((part) => part.type === "dynamic-tool").length;

	return `${state.agentRunId}:tool-call:${existingCount ?? 0}`;
}

function tryParseJson(value: string | undefined): unknown {
	if (!value) return undefined;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function isMeaningfulToolValue(value: unknown): boolean {
	if (value == null) return false;
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 && trimmed !== "{}" && trimmed !== "[]";
	}
	if (Array.isArray(value)) {
		return value.length > 0;
	}
	if (typeof value === "object") {
		return Object.keys(value as Record<string, unknown>).length > 0;
	}
	return true;
}

function readToolResultOutput(event: ImproveQuestionsAgentEvent): unknown {
	const eventRecord = event as ImproveQuestionsAgentEvent & { result?: unknown };
	return event.content ?? event.output ?? eventRecord.result ?? "";
}

function isMeaningfulToolResultOutput(output: unknown): boolean {
	if (output == null) return false;
	if (typeof output === "string") {
		const trimmed = output.trim();
		return trimmed.length > 0 && trimmed !== "{}" && trimmed !== "[]";
	}
	if (Array.isArray(output)) return output.length > 0;
	if (typeof output === "object") {
		return Object.keys(output as Record<string, unknown>).length > 0;
	}
	return true;
}

function mergeDynamicToolOutput(
	existing: unknown,
	incoming: unknown,
): unknown {
	const existingText =
		typeof existing === "string" ? existing : safeJsonString(existing);
	const incomingText =
		typeof incoming === "string" ? incoming : safeJsonString(incoming);
	if (!isMeaningfulToolResultOutput(incoming)) return existing;
	if (!isMeaningfulToolResultOutput(existing)) return incoming;
	return pickRicherToolResultContent(existingText, incomingText);
}

function createDynamicToolFromCallEvent(
	state: AgentRunState,
	event: ImproveQuestionsAgentEvent,
): DynamicToolPart {
	return {
		type: "dynamic-tool",
		toolCallId: createToolCallId(state, event),
		toolName: typeof event.name === "string" ? event.name : "unknown_tool",
		state: normalizeDynamicToolInputState(event.state),
		input: isMeaningfulToolValue(event.input)
			? event.input
			: (tryParseJson(event.arguments) ?? {}),
	} as DynamicToolPart;
}

function createDynamicToolFromResultEvent(
	state: AgentRunState,
	event: ImproveQuestionsAgentEvent,
): DynamicToolPart {
	const meta = event.meta as Record<string, unknown> | undefined;
	const candidate = meta?.toolCallId;
	const toolCallId =
		typeof candidate === "string" && candidate.length > 0
			? candidate
			: (readLatestToolCallId(state) ?? `${state.agentRunId}:tool-call:0`);
	const output = readToolResultOutput(event);
	const errorText = typeof event.error === "string" ? event.error : undefined;

	return {
		type: "dynamic-tool",
		toolCallId,
		toolName: typeof event.name === "string" ? event.name : "unknown_tool",
		state: normalizeDynamicToolOutputState(event.state, errorText),
		input: event.input ?? {},
		output: isMeaningfulToolResultOutput(output) ? output : undefined,
		errorText,
	} as DynamicToolPart;
}

function mergeDynamicToolPart(
	existing: DynamicToolPart,
	incoming: DynamicToolPart,
): DynamicToolPart {
	const mergedOutput = mergeDynamicToolOutput(existing.output, incoming.output);
	const nextState =
		incoming.state === "output-available" ||
		incoming.state === "output-error" ||
		incoming.state === "output-denied"
			? incoming.state
			: existing.state === "output-available" ||
					existing.state === "output-error" ||
					existing.state === "output-denied"
				? existing.state
				: normalizeDynamicToolInputState(incoming.state ?? existing.state);

	return {
		...existing,
		...incoming,
		toolName:
			incoming.toolName.length > 0 ? incoming.toolName : existing.toolName,
		input: isMeaningfulToolValue(incoming.input)
			? incoming.input
			: existing.input,
		output: mergedOutput,
		errorText: incoming.errorText ?? existing.errorText,
		state: nextState,
	} as DynamicToolPart;
}

function upsertDynamicToolPart(
	parts: UIMessage["parts"],
	toolPart: DynamicToolPart,
): UIMessage["parts"] {
	const existingIndex = parts.findIndex(
		(candidate) =>
			candidate.type === "dynamic-tool" &&
			candidate.toolCallId === toolPart.toolCallId,
	);

	if (existingIndex === -1) {
		if (
			toolPart.state === "output-available" &&
			!isMeaningfulToolResultOutput(toolPart.output)
		) {
			return parts;
		}
		return [...parts, toolPart];
	}

	const current = parts[existingIndex];
	if (current.type !== "dynamic-tool") return parts;

	const nextParts = [...parts];
	nextParts[existingIndex] = mergeDynamicToolPart(current, toolPart);
	return nextParts;
}

function appendAssistantToolPart(
	state: AgentRunState,
	toolPart: DynamicToolPart,
): AgentRunState {
	return withAssistantMessage(state, (message) => {
		const baseParts = hasMeaningfulAssistantParts(message.parts)
			? message.parts
			: [];
		const nextParts = stripToolTranscriptFromTextParts(baseParts);

		return {
			...message,
			parts: upsertDynamicToolPart(nextParts, toolPart),
		};
	});
}

function normalizeAgentStatus(
	status?: string,
): ImproveQuestionsAgentRunStatus {
	if (
		status === "pending" ||
		status === "running" ||
		status === "done" ||
		status === "error"
	) {
		return status;
	}
	return "running";
}

function resolveNextAgentStatus(
	existingStatus: ImproveQuestionsAgentRunStatus,
	eventStatus: string | undefined,
): ImproveQuestionsAgentRunStatus {
	if (existingStatus === "error") {
		return "error";
	}

	const normalizedEventStatus =
		eventStatus == null ? existingStatus : normalizeAgentStatus(eventStatus);

	return normalizedEventStatus;
}

function applyAgentMetadata(
	state: AgentRunState,
	event: ImproveQuestionsAgentEvent,
): AgentRunState {
	const nextWarnings = event.warning
		? [...state.warnings, event.warning]
		: state.warnings;
	const nextOutputText =
		state.outputText.length > 0
			? state.outputText
			: (event.rawText ?? state.outputText);

	return syncPromptsIntoMessages({
		...state,
		label: event.label || state.label,
		status: resolveNextAgentStatus(
			state.status,
			event.status ?? (event.error ? "error" : undefined),
		),
		systemPrompt: event.systemPrompt ?? state.systemPrompt,
		userPrompt: event.userPrompt ?? state.userPrompt,
		outputText:
			event.eventType === "result" && event.rawText
				? event.rawText
				: nextOutputText,
		error: event.error ?? state.error,
		warnings: nextWarnings,
	});
}

export function createAgentRunState(input: {
	agentRunId: string;
	label: string;
	systemPrompt?: string;
	userPrompt?: string;
}): AgentRunState {
	const systemPrompt = input.systemPrompt ?? "";
	const userPrompt = input.userPrompt ?? "";
	return {
		agentRunId: input.agentRunId,
		label: input.label,
		status: "pending",
		systemPrompt,
		userPrompt,
		outputText: "",
		messages: createAgentMessages(
			input.agentRunId,
			systemPrompt,
			userPrompt,
			"",
		),
		error: null,
		warnings: [],
	};
}

export function reduceAgentEvent(
	state: AgentRunState,
	event: AgentRunReducerEvent,
): AgentRunState {
	if (event.agentRunId !== state.agentRunId) {
		return state;
	}

	if (event.eventType === "text-chunk") {
		if (!event.text) return state;
		return event.kind === "reasoning"
			? appendAssistantThinkingMessage(state, event.text)
			: appendAssistantTextMessage(
					{
						...state,
						outputText: `${state.outputText}${event.text}`,
					},
					event.text,
				);
	}

	let nextState = applyAgentMetadata(state, event);

	if (event.eventType === "tool-call") {
		nextState = appendAssistantToolPart(
			nextState,
			createDynamicToolFromCallEvent(nextState, event),
		);
	}

	if (event.eventType === "tool-result") {
		nextState = appendAssistantToolPart(
			nextState,
			createDynamicToolFromResultEvent(nextState, event),
		);
	}

	return nextState;
}
