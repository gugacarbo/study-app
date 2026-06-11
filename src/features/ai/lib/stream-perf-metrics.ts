/** Minimum generation window used when timestamps collapse to the same ms. */
export const MIN_GENERATION_DURATION_MS = 10;

/**
 * Stream performance metrics for connection tests and similar flows.
 *
 * TTFT: elapsed ms from test start to the first model text delta.
 * Tokens/s: completion tokens divided by generation window (first text delta → stream
 * end). Prefers `generationEndedAtMs` (usage / stream finish) over the last text delta
 * so a late usage event is not treated as zero-duration generation.
 * Total request time: elapsed ms from test start to stream/process completion.
 */
export type StreamPerfMetrics = {
	ttftMs: number | null;
	tokensPerSecond: number | null;
	totalRequestMs: number | null;
};

export function computeTtftMs(
	testStartedAtMs: number,
	firstTokenAtMs: number | null,
): number | null {
	if (firstTokenAtMs == null) return null;
	const ttftMs = firstTokenAtMs - testStartedAtMs;
	return Number.isFinite(ttftMs) && ttftMs >= 0 ? ttftMs : null;
}

export function computeTotalRequestMs(
	testStartedAtMs: number,
	finishedAtMs: number | null,
): number | null {
	if (finishedAtMs == null) return null;
	const totalMs = finishedAtMs - testStartedAtMs;
	return Number.isFinite(totalMs) && totalMs >= 0 ? totalMs : null;
}

export function computeTokensPerSecond(
	completionTokens: number,
	firstTokenAtMs: number | null,
	lastTokenAtMs: number | null,
	generationEndedAtMs?: number | null,
): number | null {
	if (completionTokens <= 0) return null;
	if (firstTokenAtMs == null) return null;

	const generationEndMs = generationEndedAtMs ?? lastTokenAtMs;
	if (generationEndMs == null) return null;

	const durationMs = Math.max(
		generationEndMs - firstTokenAtMs,
		MIN_GENERATION_DURATION_MS,
	);
	const tokensPerSecond = completionTokens / (durationMs / 1000);
	return Number.isFinite(tokensPerSecond) && tokensPerSecond > 0
		? tokensPerSecond
		: null;
}

export function buildStreamPerfMetrics(input: {
	testStartedAtMs: number;
	firstTokenAtMs: number | null;
	lastTokenAtMs: number | null;
	generationEndedAtMs?: number | null;
	completionTokens?: number | null;
	finishedAtMs?: number | null;
}): StreamPerfMetrics {
	const ttftMs = computeTtftMs(input.testStartedAtMs, input.firstTokenAtMs);
	const tokensPerSecond =
		input.completionTokens != null
			? computeTokensPerSecond(
					input.completionTokens,
					input.firstTokenAtMs,
					input.lastTokenAtMs,
					input.generationEndedAtMs,
				)
			: null;
	const totalRequestMs =
		input.finishedAtMs != null
			? computeTotalRequestMs(input.testStartedAtMs, input.finishedAtMs)
			: null;

	return { ttftMs, tokensPerSecond, totalRequestMs };
}

export function formatTtft(ms: number): string {
	if (!Number.isFinite(ms) || ms < 0) return "—";
	if (ms < 1000) return `${Math.round(ms)}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

export function formatTokensPerSecond(tokensPerSecond: number): string {
	if (!Number.isFinite(tokensPerSecond) || tokensPerSecond <= 0) return "—";
	return `${Math.round(tokensPerSecond)} tok/s`;
}

export type BenchmarkPhaseMetrics = {
	phaseId: string;
	label: string;
	ttftMs: number | null;
	ttftToolMs: number | null;
	toolRoundTripMs: number | null;
	tokensPerSecond: number | null;
	phaseDurationMs: number | null;
	passed: boolean | null;
};

export type BenchmarkPerfMetrics = {
	phases: BenchmarkPhaseMetrics[];
	aggregate: StreamPerfMetrics;
};

export type BenchmarkPhaseTiming = {
	phaseStartedAtMs: number;
	firstEventAtMs: number | null;
	firstToolCallAtMs: number | null;
	toolResultAtMs: number | null;
	firstTextAtMs: number | null;
	lastTokenAtMs: number | null;
	generationEndedAtMs: number | null;
	phaseEndedAtMs: number | null;
	completionTokens: number | null;
};

export function createBenchmarkPhaseTiming(
	phaseStartedAtMs: number,
): BenchmarkPhaseTiming {
	return {
		phaseStartedAtMs,
		firstEventAtMs: null,
		firstToolCallAtMs: null,
		toolResultAtMs: null,
		firstTextAtMs: null,
		lastTokenAtMs: null,
		generationEndedAtMs: null,
		phaseEndedAtMs: null,
		completionTokens: null,
	};
}

export function noteBenchmarkPhaseTextDelta(
	timing: BenchmarkPhaseTiming,
	atMs: number,
): void {
	if (timing.firstTextAtMs == null) {
		timing.firstTextAtMs = atMs;
	}
	if (timing.firstEventAtMs == null) {
		timing.firstEventAtMs = atMs;
	}
	timing.lastTokenAtMs = atMs;
}

export function noteBenchmarkPhaseToolCall(
	timing: BenchmarkPhaseTiming,
	atMs: number,
): void {
	if (timing.firstToolCallAtMs == null) {
		timing.firstToolCallAtMs = atMs;
	}
	if (timing.firstEventAtMs == null) {
		timing.firstEventAtMs = atMs;
	}
}

export function noteBenchmarkPhaseToolResult(
	timing: BenchmarkPhaseTiming,
	atMs: number,
): void {
	timing.toolResultAtMs = atMs;
}

export function finalizeBenchmarkPhaseTiming(
	timing: BenchmarkPhaseTiming,
	phaseEndedAtMs: number,
	completionTokens?: number | null,
): void {
	timing.phaseEndedAtMs = phaseEndedAtMs;
	if (completionTokens != null) {
		timing.completionTokens = completionTokens;
	}
	if (timing.generationEndedAtMs == null) {
		timing.generationEndedAtMs = phaseEndedAtMs;
	}
}

export function buildBenchmarkPhaseMetrics(
	phaseId: string,
	label: string,
	timing: BenchmarkPhaseTiming,
	passed: boolean | null,
): BenchmarkPhaseMetrics {
	const ttftMs =
		timing.firstEventAtMs != null
			? computeTtftMs(timing.phaseStartedAtMs, timing.firstEventAtMs)
			: null;
	const ttftToolMs =
		timing.firstToolCallAtMs != null
			? computeTtftMs(timing.phaseStartedAtMs, timing.firstToolCallAtMs)
			: null;
	const toolRoundTripMs =
		timing.firstToolCallAtMs != null && timing.toolResultAtMs != null
			? timing.toolResultAtMs - timing.firstToolCallAtMs
			: null;
	const tokensPerSecond =
		timing.completionTokens != null
			? computeTokensPerSecond(
					timing.completionTokens,
					timing.firstTextAtMs ?? timing.firstEventAtMs,
					timing.lastTokenAtMs,
					timing.generationEndedAtMs,
				)
			: null;
	const phaseDurationMs =
		timing.phaseEndedAtMs != null
			? timing.phaseEndedAtMs - timing.phaseStartedAtMs
			: null;

	return {
		phaseId,
		label,
		ttftMs,
		ttftToolMs,
		toolRoundTripMs,
		tokensPerSecond,
		phaseDurationMs,
		passed,
	};
}

export function buildBenchmarkPerfMetrics(input: {
	phases: BenchmarkPhaseMetrics[];
	jobStartedAtMs: number;
	jobFinishedAtMs: number;
	firstTokenAtMs: number | null;
	lastTokenAtMs: number | null;
	generationEndedAtMs: number | null;
	totalCompletionTokens: number | null;
}): BenchmarkPerfMetrics {
	const aggregate = buildStreamPerfMetrics({
		testStartedAtMs: input.jobStartedAtMs,
		firstTokenAtMs: input.firstTokenAtMs,
		lastTokenAtMs: input.lastTokenAtMs,
		generationEndedAtMs: input.generationEndedAtMs,
		completionTokens: input.totalCompletionTokens ?? undefined,
		finishedAtMs: input.jobFinishedAtMs,
	});

	return {
		phases: input.phases,
		aggregate,
	};
}

export const EMPTY_BENCHMARK_PERF_METRICS: BenchmarkPerfMetrics = {
	phases: [],
	aggregate: {
		ttftMs: null,
		tokensPerSecond: null,
		totalRequestMs: null,
	},
};
