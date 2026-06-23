export type LlmUsage = {
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
};

export function parseLlmUsage(tokenMeta: unknown): LlmUsage | null {
	if (!tokenMeta) return null;

	let parsed: unknown;
	if (typeof tokenMeta === "string") {
		try {
			parsed = JSON.parse(tokenMeta);
		} catch {
			return null;
		}
	} else {
		parsed = tokenMeta;
	}

	if (!parsed || typeof parsed !== "object") return null;

	const record = parsed as Record<string, unknown>;
	const inputTokens = normalizeTokenCount(record.inputTokens);
	const outputTokens = normalizeTokenCount(record.outputTokens);
	const explicitTotal = normalizeTokenCount(record.totalTokens);
	const totalTokens =
		explicitTotal ?? safeAdd(inputTokens, outputTokens) ?? undefined;

	return {
		inputTokens,
		outputTokens,
		totalTokens,
	};
}

function normalizeTokenCount(value: unknown): number | undefined {
	if (typeof value === "boolean") return undefined;
	if (value == null) return undefined;
	const num = Number(value);
	if (!Number.isFinite(num) || num < 0) return undefined;
	return Math.round(num);
}

function safeAdd(a?: number, b?: number): number | undefined {
	if (a == null && b == null) return undefined;
	return (a ?? 0) + (b ?? 0);
}

function averageCost(
	inputCostPerMillion?: number | null,
	outputCostPerMillion?: number | null,
): number | null {
	if (inputCostPerMillion != null && outputCostPerMillion != null) {
		return (inputCostPerMillion + outputCostPerMillion) / 2;
	}
	return inputCostPerMillion ?? outputCostPerMillion ?? null;
}

export function calculateLlmCost(
	usage: LlmUsage | null,
	inputCostPerMillion: number | null | undefined,
	outputCostPerMillion: number | null | undefined,
): number | null {
	if (!usage) return null;
	if (inputCostPerMillion == null && outputCostPerMillion == null) return null;

	const hasExplicitInput = usage.inputTokens != null;
	const hasExplicitOutput = usage.outputTokens != null;
	const inputTokens = usage.inputTokens ?? 0;
	const outputTokens = usage.outputTokens ?? 0;

	if (!hasExplicitInput && !hasExplicitOutput) {
		const totalTokens = usage.totalTokens;
		if (totalTokens == null || totalTokens === 0) return null;

		const costPerMillion = averageCost(
			inputCostPerMillion,
			outputCostPerMillion,
		);
		if (costPerMillion == null) return null;
		return (totalTokens * costPerMillion) / 1_000_000;
	}

	const inputCost = (inputTokens * (inputCostPerMillion ?? 0)) / 1_000_000;
	const outputCost = (outputTokens * (outputCostPerMillion ?? 0)) / 1_000_000;
	const totalCost = inputCost + outputCost;

	if (totalCost === 0 && !hasExplicitInput && !hasExplicitOutput) {
		return null;
	}

	return totalCost;
}

export function formatLlmCost(value: number | null | undefined): string {
	if (value == null) return "—";
	return `US$ ${value.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 6,
	})}`;
}

export function formatTokenCount(value: number | null | undefined): string {
	if (value == null) return "—";
	return value.toLocaleString("pt-BR");
}

export function enrichLlmLogRow<
	T extends {
		tokenMeta: string | null;
		inputCostPerMillion?: number | null;
		outputCostPerMillion?: number | null;
	},
>(row: T) {
	const usage = parseLlmUsage(row.tokenMeta);
	const cost = calculateLlmCost(
		usage,
		row.inputCostPerMillion,
		row.outputCostPerMillion,
	);

	return {
		...row,
		inputTokens: usage?.inputTokens ?? null,
		outputTokens: usage?.outputTokens ?? null,
		totalTokens: usage?.totalTokens ?? null,
		cost,
	};
}
