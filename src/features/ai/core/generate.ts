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

export interface AiCallError {
	provider: string;
	model: string;
	prompt: string;
	systemPrompt?: string;
	rawOutput?: string;
	error: Error;
	stage?: string;
}

export async function generateJson<T>(
	config: ProviderConfig,
	prompt: string,
	outputSchema: SchemaInput,
	options?: {
		system?: string;
		tools?: Parameters<typeof chat>[0]["tools"];
		onError?: (info: AiCallError) => void;
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
		let fallbackText = "";
		try {
			fallbackText = String(
				await chat({
					adapter,
					messages: [{ role: "user", content: prompt }],
					systemPrompts: options?.system ? [options.system] : undefined,
					stream: false,
					tools: options?.tools,
				}),
			);
		} catch (fallbackError) {
			const err = structuredError instanceof Error ? structuredError : new Error(String(structuredError));
			options?.onError?.({
				provider: config.provider,
				model: config.model ?? "unknown",
				prompt,
				systemPrompt: options?.system,
				rawOutput: "",
				error: err,
			});
			throw structuredError;
		}

		const cleaned = extractLikelyJson(stripThinkBlocks(fallbackText));
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
			const err = structuredError instanceof Error ? structuredError : new Error(String(structuredError));
			options?.onError?.({
				provider: config.provider,
				model: config.model ?? "unknown",
				prompt,
				systemPrompt: options?.system,
				rawOutput: fallbackText,
				error: err,
			});
			console.error(
				"Fallback JSON parsing failed, throwing original structured error:",
				structuredError,
				"Raw output preview:",
				fallbackText.length > 500
					? `${fallbackText.slice(0, 500)}...`
					: fallbackText,
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

function isStructuredOutputCompleteEvent<T>(
	chunk: StreamChunk | StructuredOutputCompleteEvent<T>,
): chunk is StructuredOutputCompleteEvent<T> {
	return chunk.type === "CUSTOM" && chunk.name === "structured-output.complete";
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

export async function generateJsonStream<T>(
	config: ProviderConfig,
	prompt: string,
	outputSchema: SchemaInput,
	options?: {
		system?: string;
		tools?: Parameters<typeof chat>[0]["tools"];
		onChunk?: (chunk: StreamChunk | StructuredOutputCompleteEvent<T>) => void;
		onError?: (info: AiCallError) => void;
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

	for await (const chunk of stream) {
		options?.onChunk?.(chunk);

		if (isStructuredOutputCompleteEvent<T>(chunk)) {
			return chunk.value.object;
		}

		// Accumulate incremental deltas for fallback parsing.
		if (isTextMessageChunk(chunk)) {
			accumulatedText += chunk.delta;
		}
	}

	// Fallback: stream ended without structured-output.complete event.
	// Try to parse accumulated text as JSON.
	if (accumulatedText) {
		const stripped = stripThinkBlocks(accumulatedText);
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
			} else {
				return parsed as T;
			}
		} catch (parseError) {
			const preview =
				accumulatedText.length > 500
					? `${accumulatedText.slice(0, 500)}...`
					: accumulatedText;
			const err = parseError instanceof Error
				? parseError
				: new Error(String(parseError));
			options?.onError?.({
				provider: config.provider,
				model: config.model ?? "unknown",
				prompt,
				systemPrompt: options?.system,
				rawOutput: accumulatedText,
				error: err,
			});
			console.warn(
				"Fallback JSON parsing failed for streamed content.",
				"Accumulated text length:",
				accumulatedText.length,
				"Parse error:",
				err.message,
				"Preview:",
				preview,
			);
		}
	}

	const msg =
		"Structured output stream ended without completion event. No valid JSON could be extracted from the streamed content.";
	options?.onError?.({
		provider: config.provider,
		model: config.model ?? "unknown",
		prompt,
		systemPrompt: options?.system,
		rawOutput: accumulatedText,
		error: new Error(msg),
	});
	throw new Error(msg);
}
