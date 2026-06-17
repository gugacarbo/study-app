import { describe, expect, it } from "vitest";
import { aggregateThreadTokenUsage } from "@/features/ai/lib/aggregate-thread-token-usage";

describe("aggregateThreadTokenUsage", () => {
	it("sums usage from assistant messages", () => {
		expect(
			aggregateThreadTokenUsage([
				{ role: "user", metadata: {} },
				{
					role: "assistant",
					metadata: { usage: { inputTokens: 100, outputTokens: 20 } },
				},
				{
					role: "assistant",
					metadata: { usage: { inputTokens: 150, outputTokens: 30 } },
				},
			]),
		).toEqual({
			inputTokens: 250,
			outputTokens: 50,
			reasoningTokens: 0,
			cachedInputTokens: 0,
			totalTokens: 300,
		});
	});

	it("returns null when no assistant usage exists", () => {
		expect(aggregateThreadTokenUsage([{ role: "user" }])).toBeNull();
	});
});
