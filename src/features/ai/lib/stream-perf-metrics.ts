/**
 * Stream performance metrics for connection tests and similar flows.
 *
 * TTFT: elapsed ms from test start to the first model text delta.
 * Tokens/s: completion tokens divided by generation window (first text delta → last
 * text delta). Uses a 1 ms floor on the window to avoid divide-by-zero on instant replies.
 */
export type StreamPerfMetrics = {
	ttftMs: number | null;
	tokensPerSecond: number | null;
};

export function computeTtftMs(
	testStartedAtMs: number,
	firstTokenAtMs: number | null,
): number | null {
	if (firstTokenAtMs == null) return null;
	const ttftMs = firstTokenAtMs - testStartedAtMs;
	return Number.isFinite(ttftMs) && ttftMs >= 0 ? ttftMs : null;
}

export function computeTokensPerSecond(
	completionTokens: number,
	firstTokenAtMs: number | null,
	lastTokenAtMs: number | null,
): number | null {
	if (completionTokens <= 0) return null;
	if (firstTokenAtMs == null || lastTokenAtMs == null) return null;

	const durationMs = Math.max(lastTokenAtMs - firstTokenAtMs, 1);
	const tokensPerSecond = completionTokens / (durationMs / 1000);
	return Number.isFinite(tokensPerSecond) && tokensPerSecond > 0
		? tokensPerSecond
		: null;
}

export function buildStreamPerfMetrics(input: {
	testStartedAtMs: number;
	firstTokenAtMs: number | null;
	lastTokenAtMs: number | null;
	completionTokens?: number | null;
}): StreamPerfMetrics {
	const ttftMs = computeTtftMs(input.testStartedAtMs, input.firstTokenAtMs);
	const tokensPerSecond =
		input.completionTokens != null
			? computeTokensPerSecond(
					input.completionTokens,
					input.firstTokenAtMs,
					input.lastTokenAtMs,
				)
			: null;

	return { ttftMs, tokensPerSecond };
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
