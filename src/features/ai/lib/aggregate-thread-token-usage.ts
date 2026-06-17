import {
	getThreadMessageTokenUsage,
	type ThreadTokenUsage,
	type TokenUsageExtractableMessage,
} from "@assistant-ui/react-ai-sdk";

export interface AggregatedThreadTokenUsage {
	inputTokens: number;
	outputTokens: number;
	reasoningTokens: number;
	cachedInputTokens: number;
	totalTokens: number;
}

function addUsageField(
	total: number,
	usage: ThreadTokenUsage,
	key: keyof ThreadTokenUsage,
): number {
	const value = usage[key];
	return value != null ? total + value : total;
}

export function aggregateThreadTokenUsage(
	messages: readonly unknown[] | undefined,
): AggregatedThreadTokenUsage | null {
	if (!messages?.length) return null;

	let inputTokens = 0;
	let outputTokens = 0;
	let reasoningTokens = 0;
	let cachedInputTokens = 0;
	let hasUsage = false;

	for (const message of messages) {
		const usage = getThreadMessageTokenUsage(
			message as TokenUsageExtractableMessage,
		);
		if (!usage) continue;

		hasUsage = true;
		inputTokens = addUsageField(inputTokens, usage, "inputTokens");
		outputTokens = addUsageField(outputTokens, usage, "outputTokens");
		reasoningTokens = addUsageField(reasoningTokens, usage, "reasoningTokens");
		cachedInputTokens = addUsageField(
			cachedInputTokens,
			usage,
			"cachedInputTokens",
		);
	}

	if (!hasUsage) return null;

	return {
		inputTokens,
		outputTokens,
		reasoningTokens,
		cachedInputTokens,
		totalTokens: inputTokens + outputTokens,
	};
}
