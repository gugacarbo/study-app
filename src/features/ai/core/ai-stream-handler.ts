import type { LanguageModelUsage, TextStreamPart, ToolSet } from "ai";

type ToolCallState = "awaiting-input" | "input-streaming" | "input-complete";

export interface AiStreamToolCallPayload {
	toolCallId: string;
	name?: string;
	arguments?: string;
	input?: unknown;
	state: ToolCallState;
}

export interface AiStreamToolResultPayload {
	toolCallId: string;
	content?: unknown;
	error?: string;
	state: "streaming" | "complete" | "error";
}

export interface AiStreamHandlers {
	onTextDelta?: (delta: string) => void;
	onReasoningDelta?: (delta: string) => void;
	onUsage?: (usage: LanguageModelUsage) => void;
	onToolCall?: (payload: AiStreamToolCallPayload) => void;
	onToolResult?: (payload: AiStreamToolResultPayload) => void;
}

interface TrackedToolCall {
	name: string;
	args: string;
}

export interface AiStreamState {
	toolCalls: Map<string, TrackedToolCall>;
	loggedToolCallIds: Set<string>;
	emittedToolResultIds: Set<string>;
	emittedToolResultScores: Map<string, number>;
	rawText: string;
}

export function createAiStreamState(): AiStreamState {
	return {
		toolCalls: new Map(),
		loggedToolCallIds: new Set(),
		emittedToolResultIds: new Set(),
		emittedToolResultScores: new Map(),
		rawText: "",
	};
}

function normalizeToolResultContent(content: unknown): unknown {
	if (typeof content === "string") {
		return tryParseJson(content) ?? content;
	}
	return content;
}

export function scoreToolResultContent(content: unknown): number {
	if (content === undefined || content === null) return 0;

	const parsed = normalizeToolResultContent(content);
	if (typeof parsed === "string") {
		const trimmed = parsed.trim();
		return trimmed.length > 0 && trimmed !== "{}" && trimmed !== "[]"
			? trimmed.length
			: 0;
	}

	if (typeof parsed !== "object" || parsed === null) return 0;

	const record = parsed as Record<string, unknown>;
	if (record.ok === false) {
		return 0;
	}
	if (Array.isArray(record.data)) {
		return 10_000 + record.data.length;
	}
	if (typeof record.totalQuestions === "number") {
		return 5_000 + record.totalQuestions;
	}
	if (record.ok === true) {
		return 1_000;
	}

	try {
		return JSON.stringify(record).length;
	} catch {
		return 1;
	}
}

export function pickRicherToolResultContent(
	existing: string,
	incoming: string,
): string {
	const existingScore = scoreToolResultContent(existing);
	const incomingScore = scoreToolResultContent(incoming);
	return incomingScore >= existingScore ? incoming : existing;
}

function shouldForwardToolResult(
	state: AiStreamState,
	payload: AiStreamToolResultPayload,
): boolean {
	if (!shouldEmitToolResult(payload)) return false;

	const nextScore = scoreToolResultContent(payload.content);
	const previousScore = state.emittedToolResultScores.get(payload.toolCallId);

	if (state.emittedToolResultIds.has(payload.toolCallId)) {
		return previousScore === undefined ? false : nextScore > previousScore;
	}

	return true;
}

function markToolResultEmitted(
	state: AiStreamState,
	payload: AiStreamToolResultPayload,
): void {
	state.emittedToolResultIds.add(payload.toolCallId);
	state.emittedToolResultScores.set(
		payload.toolCallId,
		scoreToolResultContent(payload.content),
	);
}

function tryParseJson(value: string): unknown | undefined {
	if (value.trim().length === 0) return undefined;
	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
}

function isMeaningfulToolResult(content: unknown): boolean {
	if (content === undefined || content === null) return false;
	if (typeof content === "string") {
		const trimmed = content.trim();
		return trimmed.length > 0 && trimmed !== "{}" && trimmed !== "[]";
	}
	if (Array.isArray(content)) return content.length > 0;
	if (typeof content === "object") {
		return Object.keys(content).length > 0;
	}
	return true;
}

function shouldEmitToolResult(payload: AiStreamToolResultPayload): boolean {
	return Boolean(payload.error) || isMeaningfulToolResult(payload.content);
}

function readToolResultError(result: unknown): string | undefined {
	if (typeof result === "string") {
		try {
			return readToolResultError(JSON.parse(result));
		} catch {
			return result.length > 0 ? result : undefined;
		}
	}
	if (typeof result !== "object" || result === null) return undefined;
	const errorValue = (result as { error?: unknown }).error;
	if (typeof errorValue === "string" && errorValue.length > 0) {
		return errorValue;
	}
	if (typeof errorValue !== "object" || errorValue === null) return undefined;
	return typeof (errorValue as { message?: unknown }).message === "string"
		? (errorValue as { message: string }).message
		: undefined;
}

function serializeToolArguments(args: unknown): string {
	if (args === undefined) return "{}";
	try {
		return JSON.stringify(args);
	} catch {
		return "{}";
	}
}

function buildToolResultLogLine(
	toolName: string,
	input: string,
	result: unknown,
): string {
	const serializedResult =
		result === undefined
			? ""
			: typeof result === "string"
				? result
				: JSON.stringify(result);

	return `\n[tool:${toolName}] input=${input}${serializedResult ? ` result=${serializedResult}` : ""}`;
}

function shouldAppendToolResultLog(
	toolCallId: string,
	loggedToolCallIds: Set<string>,
): boolean {
	if (loggedToolCallIds.has(toolCallId)) {
		return false;
	}
	loggedToolCallIds.add(toolCallId);
	return true;
}

function readToolErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string" && error.length > 0) return error;
	return "Unknown error";
}

export function isAiStreamRunErrorChunk<TOOLS extends ToolSet>(
	chunk: TextStreamPart<TOOLS>,
): chunk is Extract<TextStreamPart<TOOLS>, { type: "error" }> {
	return chunk.type === "error";
}

export function createToolResultEmitter(
	emit: (payload: AiStreamToolResultPayload) => void,
	state: AiStreamState,
): (payload: AiStreamToolResultPayload) => void {
	return (payload) => {
		if (!shouldForwardToolResult(state, payload)) {
			return;
		}
		markToolResultEmitted(state, payload);
		emit(payload);
	};
}

export function payloadFromToolExecuteResult(
	toolCallId: string,
	content: unknown,
): AiStreamToolResultPayload {
	const error = readToolResultError(content);
	return {
		toolCallId,
		content,
		error,
		state: error ? "error" : "complete",
	};
}

export function createIncrementalToolChunkHandler<TOOLS extends ToolSet>(
	handlers: Pick<AiStreamHandlers, "onToolCall" | "onToolResult">,
	state: AiStreamState,
): (chunk: TextStreamPart<TOOLS>) => void {
	const emitToolResult = createToolResultEmitter(
		(payload) => handlers.onToolResult?.(payload),
		state,
	);

	return (chunk) => {
		processAiStreamPart(chunk, handlers, state, emitToolResult);
	};
}

export function processAiStreamPart<TOOLS extends ToolSet>(
	chunk: TextStreamPart<TOOLS>,
	handlers: AiStreamHandlers,
	state: AiStreamState,
	emitToolResult: (payload: AiStreamToolResultPayload) => void = (payload) => {
		if (!shouldForwardToolResult(state, payload)) return;
		markToolResultEmitted(state, payload);
		handlers.onToolResult?.(payload);
	},
): void {
	if (chunk.type === "text-delta" && chunk.text.length > 0) {
		state.rawText += chunk.text;
		handlers.onTextDelta?.(chunk.text);
		return;
	}

	if (chunk.type === "reasoning-delta" && chunk.text.length > 0) {
		handlers.onReasoningDelta?.(chunk.text);
		return;
	}

	if (chunk.type === "finish-step") {
		handlers.onUsage?.(chunk.usage);
		return;
	}

	switch (chunk.type) {
		case "tool-input-start": {
			const toolCallId = chunk.id;
			const name = chunk.toolName;
			state.toolCalls.set(toolCallId, { name, args: "" });
			handlers.onToolCall?.({
				toolCallId,
				name,
				state: "awaiting-input",
			});
			return;
		}
		case "tool-input-delta": {
			const toolCallId = chunk.id;
			const tracked = state.toolCalls.get(toolCallId) ?? {
				name: "unknown_tool",
				args: "",
			};
			tracked.args += chunk.delta;
			state.toolCalls.set(toolCallId, tracked);
			handlers.onToolCall?.({
				toolCallId,
				name: tracked.name,
				arguments: tracked.args,
				input: tryParseJson(tracked.args),
				state: "input-streaming",
			});
			return;
		}
		case "tool-call": {
			const toolCallId = chunk.toolCallId;
			const name = chunk.toolName;
			const input = chunk.input;
			const argumentsJson = serializeToolArguments(input);
			state.toolCalls.set(toolCallId, { name, args: argumentsJson });
			handlers.onToolCall?.({
				toolCallId,
				name,
				arguments: argumentsJson,
				input,
				state: "input-complete",
			});
			return;
		}
		case "tool-result": {
			const toolCallId = chunk.toolCallId;
			const name = chunk.toolName;
			const input = serializeToolArguments(chunk.input);
			const content = chunk.output;

			handlers.onToolCall?.({
				toolCallId,
				name,
				arguments: input,
				input: chunk.input,
				state: "input-complete",
			});

			const resultError = readToolResultError(content);
			const toolResultPayload: AiStreamToolResultPayload = {
				toolCallId,
				content,
				error: resultError,
				state: resultError ? "error" : "complete",
			};
			emitToolResult(toolResultPayload);

			if (shouldAppendToolResultLog(toolCallId, state.loggedToolCallIds)) {
				state.rawText += buildToolResultLogLine(name, input, content);
			}
			state.toolCalls.delete(toolCallId);
			return;
		}
		case "tool-error": {
			const toolCallId = chunk.toolCallId;
			const name = chunk.toolName;
			const input = serializeToolArguments(chunk.input);
			const error = readToolErrorMessage(chunk.error);
			const toolResultPayload: AiStreamToolResultPayload = {
				toolCallId,
				content: { error },
				error,
				state: "error",
			};

			handlers.onToolCall?.({
				toolCallId,
				name,
				arguments: input,
				input: chunk.input,
				state: "input-complete",
			});
			emitToolResult(toolResultPayload);

			if (shouldAppendToolResultLog(toolCallId, state.loggedToolCallIds)) {
				state.rawText += buildToolResultLogLine(name, input, { error });
			}
			state.toolCalls.delete(toolCallId);
		}
	}
}
