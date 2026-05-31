import { chat } from "@tanstack/ai";
import type {
	SchemaInput,
	StreamChunk,
	StructuredOutputCompleteEvent,
} from "@tanstack/ai";
import { getAiAdapter } from "@/features/ai/adapters/provider-adapter";
import type { ProviderConfig } from "@/lib/validation";

export async function generateText(
	config: ProviderConfig,
	prompt: string,
	options?: { system?: string },
) {
	const adapter = getAiAdapter(config);

	const result = await chat({
		adapter,
		messages: [{ role: "user", content: prompt }],
		systemPrompts: options?.system ? [options.system] : undefined,
		stream: false,
	});

	return { text: result };
}

export async function generateJson<T>(
	config: ProviderConfig,
	prompt: string,
	outputSchema: SchemaInput,
	options?: { system?: string },
): Promise<T> {
	const adapter = getAiAdapter(config);

	try {
		const result = await chat({
			adapter,
			messages: [{ role: "user", content: prompt }],
			systemPrompts: options?.system ? [options.system] : undefined,
			stream: false,
			outputSchema,
		});

		return result as T;
	} catch (structuredError) {
		const fallback = await chat({
			adapter,
			messages: [{ role: "user", content: prompt }],
			systemPrompts: options?.system ? [options.system] : undefined,
			stream: false,
		});

		const cleaned = extractLikelyJson(stripThinkBlocks(String(fallback ?? "")));
		try {
			return JSON.parse(cleaned) as T;
		} catch {
			throw structuredError;
		}
	}
}

export function stripThinkBlocks(content: string): string {
	return content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export function extractLikelyJson(content: string): string {
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

export function isStructuredOutputCompleteEvent<T>(
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
		onChunk?: (chunk: StreamChunk | StructuredOutputCompleteEvent<T>) => void;
	},
): Promise<T> {
	const adapter = getAiAdapter(config);

	const stream = chat({
		adapter,
		messages: [{ role: "user", content: prompt }],
		systemPrompts: options?.system ? [options.system] : undefined,
		stream: true,
		outputSchema,
	});

	for await (const chunk of stream) {
		options?.onChunk?.(chunk);

		if (isStructuredOutputCompleteEvent<T>(chunk)) {
			return chunk.value.object;
		}
	}

	throw new Error("Structured output stream ended without completion event");
}
