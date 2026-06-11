import type { ProviderConfig } from "@/lib/validation";

export function buildProviderOptions(config: ProviderConfig) {
	if (!config.thinkingEffort) return undefined;

	return {
		openai: {
			reasoningEffort: config.thinkingEffort,
		},
	};
}
