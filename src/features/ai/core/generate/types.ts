import type {
	SchemaInput,
	StreamChunk,
	StructuredOutputCompleteEvent,
} from "@tanstack/ai";

type SafeParseResult<T> =
	| { success: true; data: T }
	| { success: false; error: { issues?: unknown[] } };

type SafeParseCapableSchema<T> = {
	safeParse: (input: unknown) => SafeParseResult<T>;
};

function isSafeParseCapableSchema<T>(
	schema: SchemaInput,
): schema is SafeParseCapableSchema<T> {
	return (
		typeof schema === "object" &&
		schema !== null &&
		"safeParse" in schema &&
		typeof (schema as { safeParse?: unknown }).safeParse === "function"
	);
}

function isTextMessageChunk(
	chunk: unknown,
): chunk is { type: "TEXT_MESSAGE_CONTENT"; delta: string } {
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
	chunk: StreamChunk | StructuredOutputCompleteEvent<T>,
): chunk is StructuredOutputCompleteEvent<T> {
	return chunk.type === "CUSTOM" && chunk.name === "structured-output.complete";
}

function isRunErrorChunk(chunk: unknown): chunk is {
	type: "RUN_ERROR";
	message: string;
	code?: string;
	error?: { message: string; code?: string };
} {
	return (
		typeof chunk === "object" &&
		chunk !== null &&
		"type" in chunk &&
		chunk.type === "RUN_ERROR"
	);
}

function isReasoningChunk(
	chunk: unknown,
): chunk is { type: "REASONING_MESSAGE_CONTENT"; delta: string } {
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

export interface GenerateJsonStreamOnErrorInfo {
	error: Error | unknown;
	provider?: string;
	model?: string;
	rawOutput?: string;
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
