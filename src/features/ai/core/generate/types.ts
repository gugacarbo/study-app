import type { FlexibleSchema, ToolSet } from "ai";
import type { z } from "zod";
import type { LlmLogContext } from "@/lib/llm-logging";

type SafeParseResult<T> =
	| { success: true; data: T }
	| { success: false; error: { issues?: unknown[] } };

type SafeParseCapableSchema<T> = {
	safeParse: (input: unknown) => SafeParseResult<T>;
};

export type OutputSchema<T = unknown> = z.ZodType<T> | FlexibleSchema<T>;

export type StructuredOutputCompleteEvent<T> = {
	type: "CUSTOM";
	name: "structured-output.complete";
	value: { object: T };
};

export type GenerateJsonTextChunk = {
	type: "TEXT_MESSAGE_CONTENT";
	delta: string;
	content?: string;
};

export type GenerateJsonReasoningChunk = {
	type: "REASONING_MESSAGE_CONTENT";
	delta: string;
};

export type GenerateJsonRunErrorChunk = {
	type: "RUN_ERROR";
	message: string;
	code?: string;
	runId?: string;
	error?: { message: string; code?: string };
};

export type GenerateJsonStreamChunk<T> =
	| GenerateJsonTextChunk
	| GenerateJsonReasoningChunk
	| GenerateJsonRunErrorChunk
	| StructuredOutputCompleteEvent<T>
	| { type: string; [key: string]: unknown };

export interface GenerateJsonOptions {
	system?: string;
	tools?: ToolSet;
	logging?: LlmLogContext;
}

export interface GenerateJsonStreamOptions<T> extends GenerateJsonOptions {
	onChunk?: (chunk: GenerateJsonStreamChunk<T>) => void;
	onError?: (info: GenerateJsonStreamOnErrorInfo) => void;
}

export interface GenerateJsonStreamOnErrorInfo {
	error: Error | unknown;
	baseUrl?: string;
	model?: string;
	rawOutput?: string;
}

function isSafeParseCapableSchema<T>(
	schema: unknown,
): schema is SafeParseCapableSchema<T> {
	return (
		typeof schema === "object" &&
		schema !== null &&
		"safeParse" in schema &&
		typeof (schema as { safeParse?: unknown }).safeParse === "function"
	);
}

function isTextMessageChunk(chunk: unknown): chunk is GenerateJsonTextChunk {
	return (
		typeof chunk === "object" &&
		chunk !== null &&
		"type" in chunk &&
		chunk.type === "TEXT_MESSAGE_CONTENT" &&
		"delta" in chunk &&
		typeof chunk.delta === "string"
	);
}

function isStructuredOutputCompleteEvent<T>(
	chunk: GenerateJsonStreamChunk<T>,
): chunk is StructuredOutputCompleteEvent<T> {
	return chunk.type === "CUSTOM" && chunk.name === "structured-output.complete";
}

function isRunErrorChunk(chunk: unknown): chunk is GenerateJsonRunErrorChunk {
	return (
		typeof chunk === "object" &&
		chunk !== null &&
		"type" in chunk &&
		chunk.type === "RUN_ERROR"
	);
}

function isReasoningChunk(
	chunk: unknown,
): chunk is GenerateJsonReasoningChunk {
	return (
		typeof chunk === "object" &&
		chunk !== null &&
		"type" in chunk &&
		(chunk as { type: unknown }).type === "REASONING_MESSAGE_CONTENT" &&
		"delta" in chunk &&
		typeof (chunk as { delta: unknown }).delta === "string"
	);
}

const RECOVERABLE_STRUCTURED_OUTPUT_CODES = new Set<string>([
	"parse-error",
	"structured-output-parse-failed",
	"structured-output-validation-failed",
	"structured-output-missing-result",
]);

function isRecoverableStructuredOutputError(code: string | undefined): boolean {
	if (!code) return false;
	return RECOVERABLE_STRUCTURED_OUTPUT_CODES.has(code);
}

export type { SafeParseCapableSchema };
export {
	isReasoningChunk,
	isRecoverableStructuredOutputError,
	isRunErrorChunk,
	isSafeParseCapableSchema,
	isStructuredOutputCompleteEvent,
	isTextMessageChunk,
};
