import type {
	SchemaInput,
	StreamChunk,
	StructuredOutputCompleteEvent,
} from "@tanstack/ai";
import { chat } from "@tanstack/ai";
import { getAiAdapter } from "@/features/ai/adapters/provider-adapter";
import type { ProviderConfig } from "@/lib/validation";
import { tryParseFallbackCandidates } from "./json-extract";
import type { GenerateJsonStreamOnErrorInfo } from "./types";
import {
	isReasoningChunk,
	isRecoverableStructuredOutputError,
	isRunErrorChunk,
	isStructuredOutputCompleteEvent,
	isTextMessageChunk,
} from "./types";

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

		if (isStructuredOutputCompleteEvent(chunk)) {
			options?.onChunk?.(chunk);
			return chunk.value.object;
		}

		if (isRunErrorChunk(chunk)) {
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
			break;
		}

		if (isTextMessageChunk(chunk)) {
			accumulatedText += chunk.delta;
		}

		if (isReasoningChunk(chunk)) {
			accumulatedThinking += chunk.delta;
		}

		options?.onChunk?.(chunk);
	}

	if (runError) {
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
