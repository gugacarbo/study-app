import { describe, expect, it } from "vitest";
import {
	buildStreamPerfMetrics,
	computeTokensPerSecond,
	computeTtftMs,
	formatTokensPerSecond,
	formatTtft,
} from "@/features/ai/lib/stream-perf-metrics";

describe("computeTtftMs", () => {
	it("returns elapsed time to first token", () => {
		expect(computeTtftMs(1_000, 1_850)).toBe(850);
	});

	it("returns null when no token arrived", () => {
		expect(computeTtftMs(1_000, null)).toBeNull();
	});
});

describe("computeTokensPerSecond", () => {
	it("uses completion tokens over the generation window", () => {
		expect(computeTokensPerSecond(42, 1_000, 2_000)).toBe(42);
	});

	it("returns null without completion tokens", () => {
		expect(computeTokensPerSecond(0, 1_000, 2_000)).toBeNull();
	});

	it("floors zero-duration windows to 1 ms", () => {
		expect(computeTokensPerSecond(10, 1_000, 1_000)).toBe(10_000);
	});
});

describe("buildStreamPerfMetrics", () => {
	it("combines ttft and throughput", () => {
		expect(
			buildStreamPerfMetrics({
				testStartedAtMs: 0,
				firstTokenAtMs: 1_200,
				lastTokenAtMs: 3_200,
				completionTokens: 20,
			}),
		).toEqual({ ttftMs: 1_200, tokensPerSecond: 10 });
	});
});

describe("formatters", () => {
	it("formats ttft for sub-second and second ranges", () => {
		expect(formatTtft(850)).toBe("850ms");
		expect(formatTtft(1_200)).toBe("1.2s");
	});

	it("formats tokens per second", () => {
		expect(formatTokensPerSecond(41.6)).toBe("42 tok/s");
	});
});
