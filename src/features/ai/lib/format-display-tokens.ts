/**
 * Compact token counts for UI: 999 → plain, 1.0k–19.99k, 20k–999k, 1.0M+.
 */
export function formatDisplayTokens(value: number): string {
	if (!Number.isFinite(value)) return "—";

	const n = Math.round(value);
	if (n < 0) return "—";

	if (n <= 999) {
		return String(n);
	}

	if (n < 20_000) {
		const k = n / 1000;
		if (k < 10) {
			const truncated = Math.floor(k * 10) / 10;
			return `${truncated.toFixed(1)}k`;
		}
		const truncated = Math.floor(k * 100) / 100;
		return `${truncated.toFixed(2)}k`;
	}

	if (n < 1_000_000) {
		return `${Math.floor(n / 1000)}k`;
	}

	if (n < 20_000_000) {
		const m = n / 1_000_000;
		if (m < 10) {
			return `${m.toFixed(1)}M`;
		}
		return `${m.toFixed(2)}M`;
	}

	if (n < 1_000_000_000) {
		return `${Math.round(n / 1_000_000)}M`;
	}

	const b = n / 1_000_000_000;
	if (b < 10) {
		return `${b.toFixed(1)}B`;
	}
	if (b < 20) {
		return `${b.toFixed(2)}B`;
	}
	return `${Math.round(b)}B`;
}

export function formatDisplayTokenValue(
	value: number | null | undefined,
): string {
	return value == null ? "—" : formatDisplayTokens(value);
}

/** `2.0k (in 1.2k / out 800)` */
export function formatDisplayTokenInOutSummary(
	input: number,
	output: number,
	total?: number,
): string {
	const resolvedTotal = total ?? input + output;
	return `${formatDisplayTokens(resolvedTotal)} (in ${formatDisplayTokens(input)} / out ${formatDisplayTokens(output)})`;
}
