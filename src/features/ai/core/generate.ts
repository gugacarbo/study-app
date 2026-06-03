import type {
	SchemaInput,
	StreamChunk,
	StructuredOutputCompleteEvent,
} from "@tanstack/ai";
import { chat } from "@tanstack/ai";
import { getAiAdapter } from "@/features/ai/adapters/provider-adapter";
import type { ProviderConfig } from "@/lib/validation";

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

export async function generateJson<T>(
	config: ProviderConfig,
	prompt: string,
	outputSchema: SchemaInput,
	options?: {
		system?: string;
		tools?: Parameters<typeof chat>[0]["tools"];
	},
): Promise<T> {
	const adapter = getAiAdapter(config);

	try {
		const result = await chat({
			adapter,
			messages: [{ role: "user", content: prompt }],
			systemPrompts: options?.system ? [options.system] : undefined,
			stream: false,
			tools: options?.tools,
			outputSchema,
		});

		return result as T;
	} catch (structuredError) {
		const fallback = await chat({
			adapter,
			messages: [{ role: "user", content: prompt }],
			systemPrompts: options?.system ? [options.system] : undefined,
			stream: false,
			tools: options?.tools,
		});

		const cleaned = extractLikelyJson(stripThinkBlocks(String(fallback ?? "")));
		try {
			const parsed = JSON.parse(cleaned) as unknown;
			if (isSafeParseCapableSchema<T>(outputSchema)) {
				const validated = outputSchema.safeParse(parsed);
				if (!validated.success) {
					throw new Error("Fallback JSON does not match output schema");
				}
				return validated.data;
			}
			return parsed as T;
		} catch {
			console.error(
				"Fallback JSON parsing failed, throwing original structured error:",
				structuredError,
			);
			throw structuredError;
		}
	}
}

function stripThinkBlocks(content: string): string {
	// Remove <think>...</think> blocks (used by DeepSeek and similar models)
	let result = content.replace(/<think>[\s\S]*?<\/think>/gi, "");
	// Remove orphaned closing tags (model sometimes emits </think> without <think>)
	result = result.replace(/<\/think>/gi, "");
	// Remove unclosed <think> blocks — keep content after the think block.
	// Some models emit <think> followed by reasoning text, then JSON on new lines.
	// We remove the think opening tag and everything up to the first '{' or '[' that
	// starts a JSON structure, preserving the JSON after it.
	result = result.replace(/<think>[^{}[]*/gi, "");
	return result.trim();
}

function extractLikelyJson(content: string): string {
	const trimmed = content.trim();
	if (!trimmed) return trimmed;

	const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (codeFenceMatch?.[1]) {
		return codeFenceMatch[1].trim();
	}

	const objectStart = trimmed.indexOf("{");
	const objectEnd = trimmed.lastIndexOf("}");
	if (objectStart !== -1 && objectEnd > objectStart) {
		return trimmed.slice(objectStart, objectEnd + 1).trim();
	}

	const arrayStart = trimmed.indexOf("[");
	const arrayEnd = trimmed.lastIndexOf("]");
	if (arrayStart !== -1 && arrayEnd > arrayStart) {
		return trimmed.slice(arrayStart, arrayEnd + 1).trim();
	}

	return trimmed;
}

function repairJson(text: string): string {
	let result = text;

	// Remove trailing commas before } or ] (common LLM mistake)
	result = result.replace(/,\s*([\]}])/g, "$1");

	// Replace single-quoted keys and values with double-quoted equivalents.
	// This handles patterns like {'key':'value'} or {'key': 'value'}.
	// Step 1: Replace single-quoted strings (keys and values)
	result = result.replace(/'([^']*)'/g, (_match, content) => `"${content}"`);

	return result;
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

/**
 * Check for REASONING_MESSAGE_CONTENT chunks (AG-UI protocol).
 * Models like DeepSeek emit reasoning tokens via this event type.
 * Also checks for the legacy "thinking" type for compatibility.
 */
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

export interface GenerateJsonStreamOnErrorInfo {
	error: Error | unknown;
	provider?: string;
	model?: string;
	rawOutput?: string;
}

/**
 * Error codes from the TanStack AI library that mean "the model produced text
 * but the structured-output finalizer could not turn it into a valid object."
 * These are recoverable on our side: the raw text is sitting in
 * `accumulatedText` and we can try our own JSON extraction (stripThinkBlocks,
 * extractLikelyJson, repairJson) before giving up.
 *
 * Any other code (rate limits, auth, network) is a fatal provider error and
 * must be thrown unchanged.
 */
const RECOVERABLE_STRUCTURED_OUTPUT_CODES = new Set<string>([
	"structured-output-parse-failed",
	"structured-output-validation-failed",
	"structured-output-missing-result",
]);

function isRecoverableStructuredOutputError(code: string | undefined): boolean {
	if (!code) return false;
	return RECOVERABLE_STRUCTURED_OUTPUT_CODES.has(code);
}

/**
 * Attempt to rescue a structured output by extracting JSON from the raw text
 * the model streamed. Reasoning models (DeepSeek R1, Qwen QwQ) emit
 * `<think>...</think>` blocks inline with the JSON, which makes the library's
 * `JSON.parse(accumulatedContent)` call fail. This helper strips the think
 * blocks, finds the JSON envelope, repairs common issues, and validates
 * against the schema.
 *
 * Returns the parsed object on success, or `null` if extraction failed.
 */
function tryParseAccumulatedAsJson<T>(
	text: string,
	outputSchema: SchemaInput,
): T | null {
	if (!text) return null;
	const stripped = stripThinkBlocks(text);
	const extracted = extractLikelyJson(stripped);
	const repaired = repairJson(extracted);

	try {
		const parsed = JSON.parse(repaired) as unknown;
		if (isSafeParseCapableSchema<T>(outputSchema)) {
			const validated = outputSchema.safeParse(parsed);
			if (validated.success) {
				return validated.data;
			}
			console.warn(
				"Fallback JSON parsed but schema validation failed. Issues:",
				JSON.stringify(validated.error.issues, null, 2),
			);
			return null;
		}
		return parsed as T;
	} catch (parseError) {
		const preview = text.length > 500 ? `${text.slice(0, 500)}...` : text;
		console.warn(
			"Fallback JSON parsing failed for streamed content.",
			"Accumulated text length:",
			text.length,
			"Parse error:",
			parseError instanceof Error ? parseError.message : parseError,
			"Preview:",
			preview,
		);
		return null;
	}
}

function tryParseFallbackCandidates<T>(
	candidates: string[],
	outputSchema: SchemaInput,
): T | null {
	for (const candidate of candidates) {
		const parsed = tryParseAccumulatedAsJson<T>(candidate, outputSchema);
		if (parsed !== null) {
			return parsed;
		}
	}

	return null;
}

export async function generateJsonStream<T>(
	config: ProviderConfig,
	prompt: string,
	outputSchema: SchemaInput,
	options?: {
		system?: string;
		tools?: Parameters<typeof chat>[0]["tools"];
		onChunk?: (chunk: StreamChunk | StructuredOutputCompleteEvent<T>) => void;
		onError?: (info: GenerateJsonStreamOnErrorInfo) => void;
	},
): Promise<T> {
	const adapter = getAiAdapter(config);

	const stream = chat({
		adapter,
		messages: [{ role: "user", content: prompt }],
		systemPrompts: options?.system ? [options.system] : undefined,
		stream: true,
		tools: options?.tools,
		outputSchema,
	});

	let accumulatedText = "";
	let accumulatedThinking = "";
	const chunkTypes = new Set<string>();
	let runError: { message: string; code?: string } | null = null;

	for await (const chunk of stream) {
		const chunkType =
			"type" in chunk && typeof chunk.type === "string"
				? chunk.type
				: "unknown";
		chunkTypes.add(chunkType);

		// Track structured-output completion events
		if (isStructuredOutputCompleteEvent(chunk)) {
			options?.onChunk?.(chunk);
			return chunk.value.object;
		}

		// Handle RUN_ERROR events from the provider
		if (isRunErrorChunk(chunk)) {
			// RunErrorEvent has both top-level 'message'/'code' and deprecated nested 'error'
			const errorMsg = chunk.error?.message ?? chunk.message ?? String(chunk);
			const errorCode = chunk.error?.code ?? chunk.code;
			runError = { message: errorMsg, code: errorCode };
			options?.onError?.({
				error: new Error(`AI provider error: ${errorMsg}`),
				provider: config.provider,
				model: config.model,
				rawOutput:
					accumulatedText || accumulatedThinking
						? `${accumulatedThinking}${accumulatedText}`
						: undefined,
			});
			// Always break on RUN_ERROR. Fatal errors (rate limits, auth,
			// network) are rethrown below; recoverable structured-output
			// errors (parse/validation/missing-result) are rescued by the
			// post-loop fallback parser reading `accumulatedText`.
			break;
		}

		// Accumulate text deltas for fallback parsing
		if (isTextMessageChunk(chunk)) {
			accumulatedText += chunk.delta;
		}

		// Accumulate reasoning/thinking content for diagnostic info
		if (isReasoningChunk(chunk)) {
			accumulatedThinking += chunk.delta;
		}

		options?.onChunk?.(chunk);
	}

	// If we got a RUN_ERROR, throw with context
	if (runError) {
		// Fatal provider error — rethrow unchanged. Recoverable
		// structured-output errors (parse/validation/missing-result) fall
		// through to the fallback parser below.
		if (!isRecoverableStructuredOutputError(runError.code)) {
			throw new Error(
				`AI provider returned error: ${runError.message}${runError.code ? ` (code: ${runError.code})` : ""}. ` +
					`Chunk types seen: ${[...chunkTypes].join(", ")}. ` +
					`Accumulated text length: ${accumulatedText.length}, thinking length: ${accumulatedThinking.length}.`,
			);
		}
		console.warn(
			`Recovering from structured-output error (code: ${runError.code}). Attempting fallback JSON extraction on ${accumulatedText.length} chars of accumulated text.`,
		);
	}

	// Fallback: stream ended without structured-output.complete event
	// (either naturally, or because of a recoverable RUN_ERROR).
	// Try to parse accumulated text as JSON.
	const fallbackCandidates = [
		accumulatedText,
		`${accumulatedThinking}${accumulatedText}`,
		accumulatedThinking,
	].filter((candidate) => candidate.length > 0);

	if (fallbackCandidates.length > 0) {
		const rescued = tryParseFallbackCandidates<T>(
			fallbackCandidates,
			outputSchema,
		);
		if (rescued !== null) {
			return rescued;
		}
	}

	// If we have thinking content but no text content, the model may have
	// only emitted reasoning without producing JSON output.
	const diagnosticInfo = [
		`Chunk types seen: ${[...chunkTypes].join(", ") || "none"}`,
		`Accumulated text length: ${accumulatedText.length}`,
		`Accumulated thinking length: ${accumulatedThinking.length}`,
		`Provider: ${config.provider}`,
		`Model: ${config.model}`,
	].join(". ");

	throw new Error(
		`Structured output stream ended without completion event. No valid JSON could be extracted from the streamed content. ${diagnosticInfo}`,
	);
}
