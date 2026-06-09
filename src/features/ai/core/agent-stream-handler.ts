import type {
	AfterToolCallInfo,
	ChatMiddleware,
	StreamChunk,
	ToolCallHookContext,
} from "@tanstack/ai";

type ToolCallState = "awaiting-input" | "input-streaming" | "input-complete";

export interface AgentStreamToolCallPayload {
	toolCallId: string;
	name?: string;
	arguments?: string;
	input?: unknown;
	state: ToolCallState;
}

export interface AgentStreamToolResultPayload {
	toolCallId: string;
	content?: unknown;
	error?: string;
	state: "streaming" | "complete" | "error";
}

export interface AgentStreamHandlers {
	onTextDelta?: (delta: string) => void;
	onReasoningDelta?: (delta: string) => void;
	onUsage?: (usage: unknown) => void;
	onToolCall?: (payload: AgentStreamToolCallPayload) => void;
	onToolResult?: (payload: AgentStreamToolResultPayload) => void;
}

interface TrackedToolCall {
	name: string;
	args: string;
}

export interface AgentStreamState {
	toolCalls: Map<string, TrackedToolCall>;
	loggedToolCallIds: Set<string>;
	emittedToolResultIds: Set<string>;
	rawText: string;
}

export function createAgentStreamState(): AgentStreamState {
	return {
		toolCalls: new Map(),
		loggedToolCallIds: new Set(),
		emittedToolResultIds: new Set(),
		rawText: "",
	};
}

function readToolCallId(chunk: Record<string, unknown>): string | undefined {
	const id = chunk.toolCallId;
	return typeof id === "string" && id.length > 0 ? id : undefined;
}

function readToolName(chunk: Record<string, unknown>): string {
	const name = chunk.toolCallName ?? chunk.toolName;
	return typeof name === "string" && name.length > 0 ? name : "unknown_tool";
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

function shouldEmitToolResult(payload: AgentStreamToolResultPayload): boolean {
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

function readToolInput(
	chunk: Record<string, unknown>,
	tracked?: TrackedToolCall,
): unknown {
	if (chunk.input !== undefined) {
		return chunk.input;
	}
	const parsed = tryParseJson(tracked?.args ?? "");
	return parsed ?? {};
}

export function isAgentStreamRunErrorChunk(
	chunk: StreamChunk,
): chunk is Extract<StreamChunk, { type: "RUN_ERROR" }> {
	return chunk.type === "RUN_ERROR";
}

function serializeToolArguments(args: unknown): string {
	if (args === undefined) return "{}";
	try {
		return JSON.stringify(args);
	} catch {
		return "{}";
	}
}

function resolveAfterToolCallPayload(
	info: AfterToolCallInfo,
): AgentStreamToolResultPayload {
	if (info.ok) {
		return {
			toolCallId: info.toolCallId,
			content: info.result,
			state: "complete",
		};
	}

	const content =
		info.result ??
		({
			error:
				info.error instanceof Error
					? info.error.message
					: String(info.error ?? "Unknown error"),
		} as const);

	return {
		toolCallId: info.toolCallId,
		content,
		error: readToolResultError(content),
		state: "error",
	};
}

/**
 * TanStack AI batches TOOL_CALL_END chunks until every tool in the iteration
 * finishes. This middleware emits input-complete + tool-result as each tool
 * executes so the ingest UI can update tool cards independently.
 */
export function createToolResultEmitter(
	emit: (payload: AgentStreamToolResultPayload) => void,
	state: AgentStreamState,
): (payload: AgentStreamToolResultPayload) => void {
	return (payload) => {
		if (!shouldEmitToolResult(payload)) {
			return;
		}
		if (state.emittedToolResultIds.has(payload.toolCallId)) {
			return;
		}
		state.emittedToolResultIds.add(payload.toolCallId);
		emit(payload);
	};
}

export function payloadFromToolExecuteResult(
	toolCallId: string,
	content: unknown,
): AgentStreamToolResultPayload {
	const error = readToolResultError(content);
	return {
		toolCallId,
		content,
		error,
		state: error ? "error" : "complete",
	};
}

export function createIncrementalToolEventMiddleware(
	handlers: Pick<AgentStreamHandlers, "onToolCall" | "onToolResult">,
): ChatMiddleware {
	return {
		name: "incremental-tool-events",
		onBeforeToolCall(_ctx, hookCtx: ToolCallHookContext) {
			handlers.onToolCall?.({
				toolCallId: hookCtx.toolCallId,
				name: hookCtx.toolName,
				arguments: serializeToolArguments(hookCtx.args),
				input: hookCtx.args,
				state: "input-complete",
			});
		},
		onAfterToolCall(_ctx, info: AfterToolCallInfo) {
			handlers.onToolResult?.(resolveAfterToolCallPayload(info));
		},
	};
}

export function processAgentStreamChunk(
	chunk: StreamChunk,
	handlers: AgentStreamHandlers,
	state: AgentStreamState,
): void {
	const record = chunk as Record<string, unknown>;

	if (
		chunk.type === "TEXT_MESSAGE_CONTENT" &&
		typeof record.delta === "string" &&
		record.delta.length > 0
	) {
		state.rawText += record.delta;
		handlers.onTextDelta?.(record.delta);
		return;
	}

	if (
		chunk.type === "REASONING_MESSAGE_CONTENT" &&
		typeof record.delta === "string" &&
		record.delta.length > 0
	) {
		handlers.onReasoningDelta?.(record.delta);
		return;
	}

	if ("usage" in chunk && chunk.usage) {
		handlers.onUsage?.(chunk.usage);
		return;
	}

	switch (chunk.type) {
		case "TOOL_CALL_START": {
			const toolCallId = readToolCallId(record);
			if (!toolCallId) return;
			const name = readToolName(record);
			state.toolCalls.set(toolCallId, { name, args: "" });
			handlers.onToolCall?.({
				toolCallId,
				name,
				state: "awaiting-input",
			});
			return;
		}
		case "TOOL_CALL_ARGS": {
			const toolCallId = readToolCallId(record);
			if (!toolCallId) return;
			const delta = typeof record.delta === "string" ? record.delta : "";
			const accumulated =
				typeof record.args === "string" ? record.args : undefined;
			const tracked = state.toolCalls.get(toolCallId) ?? {
				name: readToolName(record),
				args: "",
			};
			if (delta.length > 0) {
				tracked.args += delta;
			} else if (accumulated) {
				tracked.args = accumulated;
			}
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
		case "TOOL_CALL_END": {
			const toolCallId = readToolCallId(record);
			if (!toolCallId) return;
			const tracked = state.toolCalls.get(toolCallId);
			const name = readToolName(record);
			const input = readToolInput(record, tracked);
			const argumentsJson = JSON.stringify(input);
			const result = record.result;

			handlers.onToolCall?.({
				toolCallId,
				name,
				arguments: argumentsJson,
				input,
				state: "input-complete",
			});

			const resultError = readToolResultError(result);
			const toolResultPayload: AgentStreamToolResultPayload = {
				toolCallId,
				content: result,
				error: resultError,
				state: resultError ? "error" : "complete",
			};
			if (
				!state.emittedToolResultIds.has(toolCallId) &&
				shouldEmitToolResult(toolResultPayload)
			) {
				handlers.onToolResult?.(toolResultPayload);
				state.emittedToolResultIds.add(toolCallId);
			}

			if (shouldAppendToolResultLog(toolCallId, state.loggedToolCallIds)) {
				state.rawText += buildToolResultLogLine(name, argumentsJson, result);
			}
			state.toolCalls.delete(toolCallId);
			return;
		}
		case "TOOL_CALL_RESULT": {
			const toolCallId = readToolCallId(record);
			if (!toolCallId) return;
			if (state.emittedToolResultIds.has(toolCallId)) return;
			const content = record.content;
			const resultError = readToolResultError(content);
			const toolResultPayload: AgentStreamToolResultPayload = {
				toolCallId,
				content,
				error: resultError,
				state: resultError ? "error" : "complete",
			};
			if (!shouldEmitToolResult(toolResultPayload)) return;
			handlers.onToolResult?.(toolResultPayload);
			state.emittedToolResultIds.add(toolCallId);
		}
	}
}
