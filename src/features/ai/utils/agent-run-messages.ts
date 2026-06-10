import type { UIMessage } from "@tanstack/ai-client";
import type { ImproveQuestionsAgentEvent } from "@/features/ai/agents/improve-questions/contracts";
import type { ImproveQuestionsAgentRunStatus } from "@/features/ai/agents/improve-questions/contracts";
import { pickRicherToolResultContent } from "@/features/ai/core/agent-stream-handler";

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
type AssistantToolCallPart = Extract<
	UIMessage["parts"][number],
	{ type: "tool-call" }
>;
type AssistantToolResultPart = Extract<
	UIMessage["parts"][number],
	{ type: "tool-result" }
>;

function createTextPart(content: string) {
	return { type: "text" as const, content };
}

function createThinkingPart(content: string) {
	return { type: "thinking" as const, content };
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
			const content = part.content ?? "";
			const strippedContent = stripStructuredToolTranscript(content);
			if (strippedContent === content) return part;
			didStrip = true;
			return { ...part, content: strippedContent };
		})
		.filter((part, index, allParts) => {
			if (part.type !== "text") return true;
			if ((part.content ?? "").length > 0) return true;
			return (
				allParts.some((candidate) => candidate.type !== "text") || index !== 0
			);
		});
}

function hasMeaningfulAssistantParts(parts: UIMessage["parts"]): boolean {
	return parts.some((part) =>
		part.type === "text" ? (part.content ?? "").length > 0 : true,
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
			content: `${lastPart.content ?? ""}${chunk}`,
		};
		return nextParts;
	}

	return [...nextParts, createTextPart(chunk)];
}

function updateTrailingThinkingPart(
	parts: UIMessage["parts"],
	chunk: string,
): UIMessage["parts"] {
	const nextParts = [...parts];
	const lastPart = nextParts.at(-1);

	if (lastPart?.type === "thinking") {
		nextParts[nextParts.length - 1] = {
			...lastPart,
			content: `${lastPart.content ?? ""}${chunk}`,
		};
		return nextParts;
	}

	return [...nextParts, createThinkingPart(chunk)];
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
					? { ...part, content }
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
			parts: updateTrailingThinkingPart(baseParts, chunk),
		};
	});
}

function readAssistantText(messages: UIMessage[]): string {
	const assistant = messages.find((message) => message.role === "assistant");
	if (!assistant) return "";
	return assistant.parts
		.filter((part) => part.type === "text")
		.map((part) => part.content ?? "")
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

function normalizeToolCallState(
	value: unknown,
): AssistantToolCallPart["state"] {
	switch (value) {
		case "awaiting-input":
		case "input-streaming":
		case "input-complete":
		case "approval-requested":
		case "approval-responded":
			return value;
		default:
			return "input-complete";
	}
}

function normalizeToolResultState(
	value: unknown,
): AssistantToolResultPart["state"] {
	switch (value) {
		case "streaming":
		case "complete":
		case "error":
			return value;
		default:
			return "complete";
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
		if (part.type === "tool-call") {
			return part.id;
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
		?.parts.filter((part) => part.type === "tool-call").length;

	return `${state.agentRunId}:tool-call:${existingCount ?? 0}`;
}

function createToolCallPart(
	state: AgentRunState,
	event: ImproveQuestionsAgentEvent,
): AssistantToolCallPart {
	return {
		type: "tool-call",
		id: createToolCallId(state, event),
		name: typeof event.name === "string" ? event.name : "unknown_tool",
		arguments:
			typeof event.arguments === "string"
				? event.arguments
				: safeJsonString(event.input ?? {}),
		input: event.input,
		output: undefined,
		state: normalizeToolCallState(event.state),
	};
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

function mergeToolCallPart(
	existing: AssistantToolCallPart,
	incoming: AssistantToolCallPart,
): AssistantToolCallPart {
	return {
		...existing,
		...incoming,
		name:
			typeof incoming.name === "string" && incoming.name.length > 0
				? incoming.name
				: existing.name,
		arguments: isMeaningfulToolValue(incoming.arguments)
			? incoming.arguments
			: existing.arguments,
		input: isMeaningfulToolValue(incoming.input)
			? incoming.input
			: existing.input,
		output: isMeaningfulToolValue(incoming.output)
			? incoming.output
			: existing.output,
		state: normalizeToolCallState(incoming.state ?? existing.state),
	};
}

function readToolResultContent(event: ImproveQuestionsAgentEvent): string {
	const eventRecord = event as ImproveQuestionsAgentEvent & { result?: unknown };
	return safeJsonString(
		event.content ?? event.output ?? eventRecord.result ?? "",
	);
}

function isMeaningfulToolResultContent(content: string): boolean {
	const trimmed = content.trim();
	return trimmed.length > 0 && trimmed !== "{}" && trimmed !== "[]";
}

function mergeToolResultPart(
	existing: AssistantToolResultPart,
	incoming: AssistantToolResultPart,
): AssistantToolResultPart {
	const mergedContent = isMeaningfulToolResultContent(incoming.content)
		? isMeaningfulToolResultContent(existing.content)
			? pickRicherToolResultContent(existing.content, incoming.content)
			: incoming.content
		: existing.content;

	return {
		...existing,
		...incoming,
		content: mergedContent,
		state: normalizeToolResultState(incoming.state ?? existing.state),
		error:
			typeof incoming.error === "string" && incoming.error.length > 0
				? incoming.error
				: incoming.state === "complete"
					? undefined
					: existing.error,
	};
}

function createToolResultPart(
	state: AgentRunState,
	event: ImproveQuestionsAgentEvent,
): AssistantToolResultPart {
	const meta = event.meta as Record<string, unknown> | undefined;
	const candidate = meta?.toolCallId;
	const toolCallId =
		typeof candidate === "string" && candidate.length > 0
			? candidate
			: (readLatestToolCallId(state) ?? `${state.agentRunId}:tool-call:0`);
	const content = readToolResultContent(event);

	return {
		type: "tool-result",
		toolCallId,
		content,
		state: normalizeToolResultState(event.state),
		error: typeof event.error === "string" ? event.error : undefined,
	};
}

function upsertAssistantToolResultPart(
	parts: UIMessage["parts"],
	resultPart: AssistantToolResultPart,
): UIMessage["parts"] {
	const nextParts = [...parts];
	const callIndex = nextParts.findIndex(
		(candidate) =>
			candidate.type === "tool-call" && candidate.id === resultPart.toolCallId,
	);

	if (callIndex !== -1) {
		const currentCall = nextParts[callIndex];
		if (currentCall.type === "tool-call") {
			const nextOutput = isMeaningfulToolResultContent(resultPart.content)
				? typeof currentCall.output === "string" &&
					isMeaningfulToolResultContent(currentCall.output)
					? pickRicherToolResultContent(currentCall.output, resultPart.content)
					: resultPart.content
				: currentCall.output;

			if (nextOutput !== undefined) {
				nextParts[callIndex] = {
					...currentCall,
					output: nextOutput,
				};
			}
		}
	}

	const existingResultIndex = nextParts.findIndex(
		(candidate) =>
			candidate.type === "tool-result" &&
			candidate.toolCallId === resultPart.toolCallId,
	);

	if (existingResultIndex !== -1) {
		const currentResult = nextParts[existingResultIndex];
		nextParts[existingResultIndex] =
			currentResult.type === "tool-result"
				? mergeToolResultPart(currentResult, resultPart)
				: resultPart;
		return nextParts;
	}

	if (!isMeaningfulToolResultContent(resultPart.content)) {
		return nextParts;
	}

	if (callIndex !== -1) {
		nextParts.splice(callIndex + 1, 0, resultPart);
		return nextParts;
	}

	return [...nextParts, resultPart];
}

function appendAssistantPart(
	state: AgentRunState,
	part: AssistantToolCallPart | AssistantToolResultPart,
): AgentRunState {
	return withAssistantMessage(state, (message) => {
		const baseParts = hasMeaningfulAssistantParts(message.parts)
			? message.parts
			: [];
		const nextParts = stripToolTranscriptFromTextParts(baseParts);

		if (part.type === "tool-result") {
			return {
				...message,
				parts: upsertAssistantToolResultPart(nextParts, part),
			};
		}

		const existingIndex = nextParts.findIndex((candidate) => {
			if (candidate.type !== part.type) return false;
			if (part.type === "tool-call" && candidate.type === "tool-call") {
				return candidate.id === part.id;
			}
			return false;
		});

		if (existingIndex !== -1) {
			const updatedParts = [...nextParts];
			const currentPart = updatedParts[existingIndex];
			updatedParts[existingIndex] =
				part.type === "tool-call" && currentPart.type === "tool-call"
					? mergeToolCallPart(currentPart, part)
					: part;

			return {
				...message,
				parts: updatedParts,
			};
		}

		return {
			...message,
			parts: [...nextParts, part],
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
		nextState = appendAssistantPart(
			nextState,
			createToolCallPart(nextState, event),
		);
	}

	if (event.eventType === "tool-result") {
		nextState = appendAssistantPart(
			nextState,
			createToolResultPart(nextState, event),
		);
	}

	return nextState;
}
