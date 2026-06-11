import type { TokenTotals } from "@/features/ai/components/token-totals-badge";

export function extractTokenTotalsFromUsage(
	value: unknown,
): TokenTotals | null {
	if (typeof value !== "object" || value === null) return null;

	const record = value as Record<string, unknown>;
	const prompt =
		typeof record.promptTokens === "number"
			? record.promptTokens
			: typeof record.inputTokens === "number"
				? record.inputTokens
				: typeof record.prompt === "number"
					? record.prompt
					: 0;
	const completion =
		typeof record.completionTokens === "number"
			? record.completionTokens
			: typeof record.outputTokens === "number"
				? record.outputTokens
				: typeof record.completion === "number"
					? record.completion
					: 0;
	const total =
		typeof record.totalTokens === "number"
			? record.totalTokens
			: typeof record.total === "number"
				? record.total
				: prompt + completion;

	if (prompt === 0 && completion === 0 && total === 0) {
		return null;
	}

	return { prompt, completion, total };
}

export interface TokenCostEstimate {
	input: number;
	output: number;
	total: number;
}

export function estimateTokenCost(
	tokenTotals: TokenTotals,
	inputCostPerMillion: number | null | undefined,
	outputCostPerMillion: number | null | undefined,
): TokenCostEstimate | null {
	if (inputCostPerMillion == null && outputCostPerMillion == null) {
		return null;
	}

	const input =
		(tokenTotals.prompt / 1_000_000) * (inputCostPerMillion ?? 0);
	const output =
		(tokenTotals.completion / 1_000_000) * (outputCostPerMillion ?? 0);

	return { input, output, total: input + output };
}

export function formatUsdCost(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return "$0.00";
	if (value < 0.0001) return "<$0.0001";
	if (value < 0.01) return `$${value.toFixed(6)}`;
	if (value < 1) return `$${value.toFixed(4)}`;
	return `$${value.toFixed(2)}`;
}
