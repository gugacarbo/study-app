import { generateObject, generateText, Output } from "ai";
import { buildProviderOptions } from "@/features/ai/adapters/provider-options";
import { getAiModel } from "@/features/ai/adapters/provider-model";
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
import { resolveObjectGenerationOptions, toFlexibleSchema } from "./schema-utils";
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

	if (options?.tools) {
		const result = await generateText({
			model,
			prompt,
			system: options.system,
			tools: options.tools,
			output: Output.object({ schema: flexibleSchema }),
			providerOptions,
		});
		return result.output as T;
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

		return result.object as T;
	} catch (structuredError) {
		if (!isRecoverableGenerationError(structuredError)) {
			throw structuredError;
		}

		const fallback = await generateText({
			model,
			prompt,
			system: options?.system,
			providerOptions,
		});

		const cleaned = extractLikelyJson(stripThinkBlocks(fallback.text));
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
				"error code:",
				extractStructuredOutputErrorCode(structuredError),
			);
			throw structuredError;
		}
	}
}
