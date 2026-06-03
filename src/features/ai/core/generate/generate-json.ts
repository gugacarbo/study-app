import type { SchemaInput } from "@tanstack/ai";
import { chat } from "@tanstack/ai";
import { getAiAdapter } from "@/features/ai/adapters/provider-adapter";
import type { ProviderConfig } from "@/lib/validation";
import { extractLikelyJson, stripThinkBlocks } from "./json-extract";
import { isSafeParseCapableSchema } from "./types";

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
