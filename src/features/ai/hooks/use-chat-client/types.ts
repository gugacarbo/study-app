export interface ChatUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

export function toNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

export function parseUsageFromChunk(chunk: unknown): ChatUsage | null {
	if (!chunk || typeof chunk !== "object") return null;
	const raw = (chunk as Record<string, unknown>).usage;
	if (!raw || typeof raw !== "object") return null;
	const usage = raw as Record<string, unknown>;

	const promptTokens =
		toNumber(usage.promptTokens) ?? toNumber(usage.inputTokens);
	const completionTokens =
		toNumber(usage.completionTokens) ?? toNumber(usage.outputTokens);
	const totalTokens =
		toNumber(usage.totalTokens) ??
		toNumber(usage.total_tokens) ??
		(promptTokens != null && completionTokens != null
			? promptTokens + completionTokens
			: null);

	if (promptTokens == null || completionTokens == null || totalTokens == null) {
		return null;
	}

	return { promptTokens, completionTokens, totalTokens };
}
