import { describe, expect, it } from "vitest";
import {
	estimateTokenCost,
	extractTokenTotalsFromUsage,
	formatUsdCost,
} from "@/features/ai/lib/token-usage";

describe("extractTokenTotalsFromUsage", () => {
	it("normalizes AI SDK usage fields", () => {
		expect(
			extractTokenTotalsFromUsage({
				inputTokens: 120,
				outputTokens: 30,
				totalTokens: 150,
			}),
		).toEqual({ prompt: 120, completion: 30, total: 150 });
	});

	it("returns null for empty usage", () => {
		expect(extractTokenTotalsFromUsage({})).toBeNull();
	});
});

describe("estimateTokenCost", () => {
	it("computes per-million token pricing", () => {
		expect(
			estimateTokenCost(
				{ prompt: 1_000_000, completion: 500_000, total: 1_500_000 },
				3,
				15,
			),
		).toEqual({ input: 3, output: 7.5, total: 10.5 });
	});

	it("returns null when model has no pricing", () => {
		expect(
			estimateTokenCost({ prompt: 10, completion: 5, total: 15 }, null, null),
		).toBeNull();
	});
});

describe("formatUsdCost", () => {
	it("formats small and large values", () => {
		expect(formatUsdCost(0)).toBe("$0.00");
		expect(formatUsdCost(0.00005)).toBe("<$0.0001");
		expect(formatUsdCost(1.25)).toBe("$1.25");
	});
});
