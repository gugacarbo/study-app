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

type StructuredOutputCompleteEvent<T> = {
	type: "CUSTOM";
	name: "structured-output.complete";
	value: { object: T };
};

type GenerateJsonTextChunk = {
	type: "TEXT_MESSAGE_CONTENT";
	delta: string;
	content?: string;
};

type GenerateJsonReasoningChunk = {
	type: "REASONING_MESSAGE_CONTENT";
	delta: string;
};

type GenerateJsonRunErrorChunk = {
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
export { isRecoverableStructuredOutputError, isSafeParseCapableSchema };
