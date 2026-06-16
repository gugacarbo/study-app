import { Output, streamObject } from "ai";
import { getAiModel } from "@/features/ai/adapters/provider-model";
import { buildProviderOptions } from "@/features/ai/adapters/provider-options";
import { loggedStreamText } from "@/features/ai/core/logged-stream-text";
import {
	buildLlmLogInsert,
	createLlmLogContext,
	scheduleLlmLog,
} from "@/lib/llm-logging";
import {
	type ProviderConfig,
	type ResolvedModelConfig,
	toProviderConfig,
} from "@/lib/validation";
import {
	extractStructuredOutputErrorCode,
	isRecoverableGenerationError,
} from "./error-utils";
import { tryParseFallbackCandidates } from "./json-extract";
import {
	resolveObjectGenerationOptions,
	toFlexibleSchema,
} from "./schema-utils";
import type { GenerateJsonStreamOptions, OutputSchema } from "./types";
import { isRecoverableStructuredOutputError } from "./types";

type StreamFailure = { message: string; code?: string };

export async function generateJsonStream<T>(
	config: ProviderConfig | ResolvedModelConfig,
	prompt: string,
	outputSchema: OutputSchema<T>,
	options?: GenerateJsonStreamOptions<T>,
): Promise<T> {
	const providerConfig = toProviderConfig(config);
	const model = getAiModel(providerConfig);
	const providerOptions = buildProviderOptions(providerConfig);
	const { schema, output } = resolveObjectGenerationOptions(outputSchema);
	const flexibleSchema = toFlexibleSchema(outputSchema);

	if (options?.tools) {
		return generateJsonStreamWithTools(
			providerConfig,
			model,
			prompt,
			outputSchema,
			flexibleSchema,
			options,
		);
	}

	const startedAt = Date.now();
	const requestPayload = { prompt, system: options?.system };
	const logging =
		options?.logging ??
		createLlmLogContext("generate-json-stream", providerConfig, {
			systemPrompt: options?.system,
			requestSummary: "structured object stream",
		});

	const result = streamObject({
		model,
		prompt,
		system: options?.system,
		schema,
		output,
		providerOptions,
		onError: (event) => {
			if (logging) {
				scheduleLlmLog(
					buildLlmLogInsert(logging, {
						status: "failed",
						startedAt,
						errorMessage:
							event.error instanceof Error
								? event.error.message
								: String(event.error),
						requestPayload,
					}),
				);
			}
			options?.onError?.({
				error: event.error,
				baseUrl: providerConfig.baseUrl,
				model: providerConfig.model,
			});
		},
		onFinish: (event) => {
			if (!logging) return;
			const status = event.error ? "failed" : "success";
			scheduleLlmLog(
				buildLlmLogInsert(logging, {
					status,
					startedAt,
					finish: {
						text:
							event.object !== undefined ? JSON.stringify(event.object) : "",
						finishReason: status,
						usage: event.usage,
					},
					requestPayload,
					responsePayload: { object: event.object },
					errorMessage:
						event.error instanceof Error
							? event.error.message
							: event.error
								? String(event.error)
								: undefined,
				}),
			);
		},
	});

	return consumeStructuredObjectStream(
		result,
		providerConfig,
		outputSchema,
		options,
		startedAt,
	);
}

async function generateJsonStreamWithTools<T>(
	config: ProviderConfig,
	model: ReturnType<typeof getAiModel>,
	prompt: string,
	outputSchema: OutputSchema<T>,
	flexibleSchema: ReturnType<typeof toFlexibleSchema<T>>,
	options: GenerateJsonStreamOptions<T>,
): Promise<T> {
	const logging =
		options.logging ??
		createLlmLogContext("generate-json-stream", config, {
			systemPrompt: options.system,
			requestSummary: "structured output with tools",
		});

	const result = loggedStreamText(logging, {
		model,
		prompt,
		system: options.system,
		tools: options.tools,
		output: Output.object({ schema: flexibleSchema }),
		providerOptions: buildProviderOptions(config),
		onError: (event) => {
			options.onError?.({
				error: event.error,
				baseUrl: config.baseUrl,
				model: config.model,
			});
		},
	});

	let accumulatedText = "";
	let accumulatedThinking = "";
	const chunkTypes = new Set<string>();
	let streamFailure: StreamFailure | null = null;

	for await (const chunk of result.fullStream) {
		chunkTypes.add(chunk.type);

		if (chunk.type === "text-delta") {
			accumulatedText += chunk.text;
			options.onChunk?.({
				type: "TEXT_MESSAGE_CONTENT",
				delta: chunk.text,
				content: accumulatedText,
			});
			continue;
		}

		if (chunk.type === "reasoning-delta") {
			accumulatedThinking += chunk.text;
			options.onChunk?.({
				type: "REASONING_MESSAGE_CONTENT",
				delta: chunk.text,
			});
			continue;
		}

		if (chunk.type === "error") {
			const errorMsg =
				chunk.error instanceof Error
					? chunk.error.message
					: String(chunk.error);
			const errorCode = extractStructuredOutputErrorCode(chunk.error);
			streamFailure = { message: errorMsg, code: errorCode };
			options.onError?.({
				error:
					chunk.error instanceof Error
						? chunk.error
						: new Error(`AI provider error: ${errorMsg}`),
				baseUrl: config.baseUrl,
				model: config.model,
				rawOutput:
					accumulatedText || accumulatedThinking
						? `${accumulatedThinking}${accumulatedText}`
						: undefined,
			});
			options.onChunk?.({
				type: "RUN_ERROR",
				message: errorMsg,
				code: errorCode,
			});
			if (!isRecoverableGenerationError(chunk.error)) {
				break;
			}
		}
	}

	throwIfFatalStreamFailure(
		streamFailure,
		chunkTypes,
		accumulatedText.length,
		accumulatedThinking.length,
	);

	try {
		const object = await result.output;
		if (object !== undefined) {
			options.onChunk?.({
				type: "CUSTOM",
				name: "structured-output.complete",
				value: { object: object as T },
			});
			return object as T;
		}
	} catch {
		// Fall through to JSON extraction.
	}

	return resolveStructuredOutputFallback(
		config,
		outputSchema,
		[
			accumulatedText,
			`${accumulatedThinking}${accumulatedText}`,
			accumulatedThinking,
		],
		chunkTypes,
		accumulatedText.length,
		accumulatedThinking.length,
	);
}

async function consumeStructuredObjectStream<T>(
	result: ReturnType<typeof streamObject>,
	config: ProviderConfig,
	outputSchema: OutputSchema<T>,
	options?: GenerateJsonStreamOptions<T>,
	_startedAt?: number,
): Promise<T> {
	let accumulatedText = "";
	const accumulatedThinking = "";
	const chunkTypes = new Set<string>();
	let streamFailure: StreamFailure | null = null;
	let latestObject: T | undefined;

	for await (const chunk of result.fullStream) {
		chunkTypes.add(chunk.type);

		if (chunk.type === "text-delta") {
			accumulatedText += chunk.textDelta;
			options?.onChunk?.({
				type: "TEXT_MESSAGE_CONTENT",
				delta: chunk.textDelta,
			});
			continue;
		}

		if (chunk.type === "object") {
			latestObject = chunk.object as T;
			options?.onChunk?.({
				type: "CUSTOM",
				name: "structured-output.complete",
				value: { object: chunk.object as T },
			});
			continue;
		}

		if (chunk.type === "error") {
			const errorMsg =
				chunk.error instanceof Error
					? chunk.error.message
					: String(chunk.error);
			const errorCode = extractStructuredOutputErrorCode(chunk.error);
			streamFailure = { message: errorMsg, code: errorCode };
			options?.onError?.({
				error:
					chunk.error instanceof Error
						? chunk.error
						: new Error(`AI provider error: ${errorMsg}`),
				baseUrl: config.baseUrl,
				model: config.model,
				rawOutput:
					accumulatedText || accumulatedThinking
						? `${accumulatedThinking}${accumulatedText}`
						: undefined,
			});
			options?.onChunk?.({
				type: "RUN_ERROR",
				message: errorMsg,
				code: errorCode,
			});
		}
	}

	throwIfFatalStreamFailure(
		streamFailure,
		chunkTypes,
		accumulatedText.length,
		accumulatedThinking.length,
	);

	if (latestObject !== undefined) {
		return latestObject;
	}

	try {
		const object = await result.object;
		if (object !== undefined) {
			options?.onChunk?.({
				type: "CUSTOM",
				name: "structured-output.complete",
				value: { object: object as T },
			});
			return object as T;
		}
	} catch {
		// Fall through to JSON extraction.
	}

	return resolveStructuredOutputFallback(
		config,
		outputSchema,
		[
			accumulatedText,
			`${accumulatedThinking}${accumulatedText}`,
			accumulatedThinking,
		],
		chunkTypes,
		accumulatedText.length,
		accumulatedThinking.length,
	);
}

function throwIfFatalStreamFailure(
	streamFailure: StreamFailure | null,
	chunkTypes: Set<string>,
	accumulatedTextLength: number,
	accumulatedThinkingLength: number,
): void {
	if (
		streamFailure &&
		!isRecoverableStructuredOutputError(streamFailure.code)
	) {
		throw new Error(
			`AI provider returned error: ${streamFailure.message}${streamFailure.code ? ` (code: ${streamFailure.code})` : ""}. ` +
				`Chunk types seen: ${[...chunkTypes].join(", ")}. ` +
				`Accumulated text length: ${accumulatedTextLength}, thinking length: ${accumulatedThinkingLength}.`,
		);
	}

	if (streamFailure) {
		console.warn(
			`Recovering from structured-output error (code: ${streamFailure.code ?? "unknown"}). Attempting fallback JSON extraction on ${accumulatedTextLength} chars of accumulated text.`,
		);
	}
}

function resolveStructuredOutputFallback<T>(
	config: ProviderConfig,
	outputSchema: OutputSchema<T>,
	fallbackCandidates: string[],
	chunkTypes: Set<string>,
	accumulatedTextLength: number,
	accumulatedThinkingLength: number,
): T {
	const filteredCandidates = fallbackCandidates.filter(
		(candidate) => candidate.length > 0,
	);

	if (filteredCandidates.length > 0) {
		const rescued = tryParseFallbackCandidates<T>(
			filteredCandidates,
			outputSchema,
		);
		if (rescued !== null) {
			return rescued;
		}
	}

	const diagnosticInfo = [
		`Chunk types seen: ${[...chunkTypes].join(", ") || "none"}`,
		`Accumulated text length: ${accumulatedTextLength}`,
		`Accumulated thinking length: ${accumulatedThinkingLength}`,
		`Base URL: ${config.baseUrl}`,
		`Model: ${config.model}`,
	].join(". ");

	throw new Error(
		`Structured output stream ended without completion event. No valid JSON could be extracted from the streamed content. ${diagnosticInfo}`,
	);
}
