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
			throw structuredError;
		}
	}
}

function stripThinkBlocks(content: string): string {
	return content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
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

function isStructuredOutputCompleteEvent<T>(
	chunk: StreamChunk | StructuredOutputCompleteEvent<T>,
): chunk is StructuredOutputCompleteEvent<T> {
	return chunk.type === "CUSTOM" && chunk.name === "structured-output.complete";
}

export async function generateJsonStream<T>(
	config: ProviderConfig,
	prompt: string,
	outputSchema: SchemaInput,
	options?: {
		system?: string;
		tools?: Parameters<typeof chat>[0]["tools"];
		onChunk?: (chunk: StreamChunk | StructuredOutputCompleteEvent<T>) => void;
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

		// Accumulate text content from streaming chunks for fallback parsing
		if (
			"type" in chunk &&
			chunk.type === "TEXT_MESSAGE_CONTENT" &&
			"content" in chunk &&
			typeof chunk.content === "string"
		) {
			accumulatedText += chunk.content;
		}
	}

	// Fallback: stream ended without structured-output.complete event.
	// Try to parse accumulated text as JSON.
	if (accumulatedText) {
		const cleaned = extractLikelyJson(stripThinkBlocks(accumulatedText));
		try {
			const parsed = JSON.parse(cleaned) as unknown;
			if (isSafeParseCapableSchema<T>(outputSchema)) {
				const validated = outputSchema.safeParse(parsed);
				if (validated.success) {
					return validated.data;
				}
			} else {
				return parsed as T;
			}
		} catch {
			// Fall through to error
		}
	}

	throw new Error(
		"Structured output stream ended without completion event. No valid JSON could be extracted from the streamed content.",
	);
}
