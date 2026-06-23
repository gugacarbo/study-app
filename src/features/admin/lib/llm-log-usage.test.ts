import { describe, expect, it } from "vitest";
import {
	calculateLlmCost,
	formatLlmCost,
	formatTokenCount,
	parseLlmUsage,
} from "./llm-log-usage";

describe("parseLlmUsage", () => {
	it("returns null for nullish input", () => {
		expect(parseLlmUsage(null)).toBeNull();
		expect(parseLlmUsage(undefined)).toBeNull();
		expect(parseLlmUsage("")).toBeNull();
	});

	it("parses JSON string usage", () => {
		expect(
			parseLlmUsage(
				JSON.stringify({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
			),
		).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
	});

	it("parses object usage", () => {
		expect(
			parseLlmUsage({ inputTokens: 5, outputTokens: 15, totalTokens: 20 }),
		).toEqual({ inputTokens: 5, outputTokens: 15, totalTokens: 20 });
	});

	it("ignores invalid JSON strings", () => {
		expect(parseLlmUsage("not-json")).toBeNull();
	});

	it("ignores non-numeric token values", () => {
		expect(
			parseLlmUsage({ inputTokens: "a", outputTokens: true, totalTokens: {} }),
		).toEqual({
			inputTokens: undefined,
			outputTokens: undefined,
			totalTokens: undefined,
		});
	});

	it("derives total from input and output when absent", () => {
		expect(parseLlmUsage({ inputTokens: 7, outputTokens: 3 })).toEqual({
			inputTokens: 7,
			outputTokens: 3,
			totalTokens: 10,
		});
	});
});

describe("calculateLlmCost", () => {
	it("returns null when no tokens are present", () => {
		expect(
			calculateLlmCost(
				{ inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
				1,
				2,
			),
		).toBeNull();
	});

	it("returns null when both costs are missing", () => {
		expect(
			calculateLlmCost(
				{ inputTokens: 1_000_000, outputTokens: 500_000, totalTokens: 1_500_000 },
				null,
				null,
			),
		).toBeNull();
	});

	it("calculates cost for input and output tokens", () => {
		expect(
			calculateLlmCost(
				{ inputTokens: 2_000_000, outputTokens: 500_000, totalTokens: 2_500_000 },
				1.5,
				6,
			),
		).toBe(6);
	});

	it("calculates cost using only input cost when output tokens are missing", () => {
		expect(
			calculateLlmCost(
				{ inputTokens: 1_000_000, outputTokens: undefined, totalTokens: undefined },
				3,
				null,
			),
		).toBe(3);
	});

	it("calculates cost using only output cost when input tokens are missing", () => {
		expect(
			calculateLlmCost(
				{ inputTokens: undefined, outputTokens: 1_000_000, totalTokens: undefined },
				null,
				2,
			),
		).toBe(2);
	});

	it("ignores total tokens when input and output are present", () => {
		const cost = calculateLlmCost(
			{ inputTokens: 0, outputTokens: 0, totalTokens: 999 },
			1,
			2,
		);
		expect(cost).toBe(0);
	});

	it("uses total tokens when input/output are missing and both costs exist", () => {
		const cost = calculateLlmCost(
			{ inputTokens: undefined, outputTokens: undefined, totalTokens: 1_000_000 },
			1,
			2,
		);
		expect(cost).toBe(1.5);
	});
});

describe("formatLlmCost", () => {
	it("returns em dash for null or undefined", () => {
		expect(formatLlmCost(null)).toBe("—");
		expect(formatLlmCost(undefined)).toBe("—");
	});

	it("formats US dollars with up to 6 decimals", () => {
		expect(formatLlmCost(0.123456)).toBe("US$ 0.123456");
	});

	it("formats zero cost", () => {
		expect(formatLlmCost(0)).toBe("US$ 0.00");
	});
});

describe("formatTokenCount", () => {
	it("returns em dash for null or undefined", () => {
		expect(formatTokenCount(null)).toBe("—");
		expect(formatTokenCount(undefined)).toBe("—");
	});

	it("formats integers with locale separators", () => {
		expect(formatTokenCount(1234)).toBe("1.234");
	});
});
