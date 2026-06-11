import { describe, expect, it } from "vitest";
import {
	buildBenchmarkPerfMetrics,
	buildBenchmarkPhaseMetrics,
	createBenchmarkPhaseTiming,
	finalizeBenchmarkPhaseTiming,
	noteBenchmarkPhaseTextDelta,
	noteBenchmarkPhaseToolCall,
	noteBenchmarkPhaseToolResult,
	buildStreamPerfMetrics,
	computeTokensPerSecond,
	computeTotalRequestMs,
	computeTtftMs,
	formatTokensPerSecond,
	formatTtft,
	MIN_GENERATION_DURATION_MS,
} from "@/features/ai/lib/stream-perf-metrics";

describe("computeTtftMs", () => {
	it("returns elapsed time to first token", () => {
		expect(computeTtftMs(1_000, 1_850)).toBe(850);
	});

	it("returns null when no token arrived", () => {
		expect(computeTtftMs(1_000, null)).toBeNull();
	});
});

describe("computeTotalRequestMs", () => {
	it("returns elapsed time from test start to finish", () => {
		expect(computeTotalRequestMs(1_000, 3_400)).toBe(2_400);
	});

	it("returns null when the request has not finished", () => {
		expect(computeTotalRequestMs(1_000, null)).toBeNull();
	});
});

describe("computeTokensPerSecond", () => {
	it("uses completion tokens over the generation window", () => {
		expect(computeTokensPerSecond(42, 1_000, 2_000)).toBe(42);
	});

	it("returns null without completion tokens", () => {
		expect(computeTokensPerSecond(0, 1_000, 2_000)).toBeNull();
	});

	it("prefers generationEndedAtMs over lastTokenAtMs for the window end", () => {
		expect(computeTokensPerSecond(42, 1_000, 1_000, 1_500)).toBe(84);
	});

	it("floors collapsed windows to MIN_GENERATION_DURATION_MS", () => {
		expect(computeTokensPerSecond(10, 1_000, 1_000)).toBe(
			10_000 / MIN_GENERATION_DURATION_MS,
		);
	});

	it("avoids million-scale tok/s when usage arrives after a single delta", () => {
		const firstTokenAtMs = 1_000;
		const lastTokenAtMs = 1_000;
		const generationEndedAtMs = 1_100;
		const completionTokens = 1_262;

		expect(
			computeTokensPerSecond(
				completionTokens,
				firstTokenAtMs,
				lastTokenAtMs,
				generationEndedAtMs,
			),
		).toBeCloseTo(12_620);
		expect(
			computeTokensPerSecond(
				completionTokens,
				firstTokenAtMs,
				lastTokenAtMs,
				generationEndedAtMs,
			),
		).not.toBe(1_262_000);
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
		).toEqual({
			ttftMs: 1_200,
			tokensPerSecond: 10,
			totalRequestMs: null,
		});
	});

	it("uses generationEndedAtMs when provided", () => {
		expect(
			buildStreamPerfMetrics({
				testStartedAtMs: 0,
				firstTokenAtMs: 1_000,
				lastTokenAtMs: 1_000,
				generationEndedAtMs: 2_000,
				completionTokens: 50,
			}),
		).toEqual({
			ttftMs: 1_000,
			tokensPerSecond: 50,
			totalRequestMs: null,
		});
	});

	it("includes total request time when finishedAtMs is provided", () => {
		expect(
			buildStreamPerfMetrics({
				testStartedAtMs: 500,
				firstTokenAtMs: 1_200,
				lastTokenAtMs: 3_200,
				finishedAtMs: 3_900,
				completionTokens: 20,
			}),
		).toEqual({
			ttftMs: 700,
			tokensPerSecond: 10,
			totalRequestMs: 3_400,
		});
	});
});

describe("benchmark phase metrics", () => {
	it("builds per-phase metrics with tool timing", () => {
		const timing = createBenchmarkPhaseTiming(1_000);
		noteBenchmarkPhaseToolCall(timing, 1_250);
		noteBenchmarkPhaseToolResult(timing, 1_400);
		noteBenchmarkPhaseTextDelta(timing, 1_500);
		noteBenchmarkPhaseTextDelta(timing, 1_700);
		finalizeBenchmarkPhaseTiming(timing, 2_000, 20);

		expect(
			buildBenchmarkPhaseMetrics("tool_math", "Tool math", timing, true),
		).toEqual({
			phaseId: "tool_math",
			label: "Tool math",
			ttftMs: 250,
			ttftToolMs: 250,
			toolRoundTripMs: 150,
			tokensPerSecond: 40,
			phaseDurationMs: 1_000,
			passed: true,
		});
	});

	it("aggregates benchmark metrics across phases", () => {
		const phases = [
			buildBenchmarkPhaseMetrics(
				"text_baseline",
				"Text baseline",
				(() => {
					const timing = createBenchmarkPhaseTiming(0);
					noteBenchmarkPhaseTextDelta(timing, 200);
					finalizeBenchmarkPhaseTiming(timing, 1_000, 10);
					return timing;
				})(),
				true,
			),
		];

		expect(
			buildBenchmarkPerfMetrics({
				phases,
				jobStartedAtMs: 0,
				jobFinishedAtMs: 5_000,
				firstTokenAtMs: 200,
				lastTokenAtMs: 900,
				generationEndedAtMs: 1_000,
				totalCompletionTokens: 10,
			}),
		).toEqual({
			phases,
			aggregate: {
				ttftMs: 200,
				tokensPerSecond: 12.5,
				totalRequestMs: 5_000,
			},
		});
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
