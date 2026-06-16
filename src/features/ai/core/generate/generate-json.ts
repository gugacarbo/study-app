import { generateObject, generateText, Output } from "ai";
import { getAiModel } from "@/features/ai/adapters/provider-model";
import { buildProviderOptions } from "@/features/ai/adapters/provider-options";
import {
	logSyncGenerationError,
	logSyncGenerationResult,
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
import { extractLikelyJson, stripThinkBlocks } from "./json-extract";
import {
	resolveObjectGenerationOptions,
	toFlexibleSchema,
} from "./schema-utils";
import type { GenerateJsonOptions, OutputSchema } from "./types";
import { isSafeParseCapableSchema } from "./types";

export async function generateJson<T>(
	config: ProviderConfig | ResolvedModelConfig,
	prompt: string,
	outputSchema: OutputSchema<T>,
	options?: GenerateJsonOptions,
): Promise<T> {
	const providerConfig = toProviderConfig(config);
	const model = getAiModel(providerConfig);
	const providerOptions = buildProviderOptions(providerConfig);
	const { schema, output } = resolveObjectGenerationOptions(outputSchema);
	const flexibleSchema = toFlexibleSchema(outputSchema);
	const startedAt = Date.now();
	const requestPayload = { prompt, system: options?.system };
	const logging = options?.logging;

	if (options?.tools) {
		try {
			const result = await generateText({
				model,
				prompt,
				system: options.system,
				tools: options.tools,
				output: Output.object({ schema: flexibleSchema }),
				providerOptions,
			});
			if (logging) {
				logSyncGenerationResult(
					logging,
					{
						text: result.text,
						usage: result.totalUsage,
						finishReason: result.finishReason,
						object: result.output,
						steps: result.steps,
					},
					startedAt,
					requestPayload,
				);
			}
			return result.output as T;
		} catch (error) {
			if (logging) {
				logSyncGenerationError(logging, error, startedAt, requestPayload);
			}
			throw error;
		}
	}

	try {
		const result = await generateObject({
			model,
			prompt,
			system: options?.system,
			schema,
			output,
			providerOptions,
		});

		if (logging) {
			logSyncGenerationResult(
				logging,
				{
					usage: result.usage,
					finishReason: result.finishReason,
					object: result.object,
				},
				startedAt,
				requestPayload,
			);
		}

		return result.object as T;
	} catch (structuredError) {
		if (!isRecoverableGenerationError(structuredError)) {
			if (logging) {
				logSyncGenerationError(
					logging,
					structuredError,
					startedAt,
					requestPayload,
				);
			}
			throw structuredError;
		}

		try {
			const fallback = await generateText({
				model,
				prompt,
				system: options?.system,
				providerOptions,
			});

			const cleaned = extractLikelyJson(stripThinkBlocks(fallback.text));
			const parsed = JSON.parse(cleaned) as unknown;
			let value: T;
			if (isSafeParseCapableSchema<T>(outputSchema)) {
				const validated = outputSchema.safeParse(parsed);
				if (!validated.success) {
					throw new Error("Fallback JSON does not match output schema");
				}
				value = validated.data;
			} else {
				value = parsed as T;
			}

			if (logging) {
				logSyncGenerationResult(
					logging,
					{
						text: fallback.text,
						usage: fallback.totalUsage,
						finishReason: fallback.finishReason,
						object: value,
					},
					startedAt,
					requestPayload,
				);
			}

			return value;
		} catch (fallbackError) {
			if (logging) {
				logSyncGenerationError(
					logging,
					fallbackError,
					startedAt,
					requestPayload,
				);
			}
			console.error(
				"Fallback JSON parsing failed, throwing original structured error:",
				structuredError,
				"error code:",
				extractStructuredOutputErrorCode(structuredError),
			);
			throw structuredError;
		}
	}
}
