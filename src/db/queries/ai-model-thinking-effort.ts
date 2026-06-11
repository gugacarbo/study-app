import {
	THINKING_EFFORT_LEVELS,
	type ThinkingEffortLevel,
	thinkingEffortLevelSchema,
} from "@/lib/validation";

export function parseThinkingEffortLevels(
	raw: string | null | undefined,
): ThinkingEffortLevel[] {
	if (!raw?.trim()) return [];

	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		const levels = parsed.flatMap((value) => {
			const result = thinkingEffortLevelSchema.safeParse(value);
			return result.success ? [result.data] : [];
		});

		return THINKING_EFFORT_LEVELS.filter((level) => levels.includes(level));
	} catch {
		return [];
	}
}

export function serializeThinkingEffortLevels(
	levels: ThinkingEffortLevel[],
): string | null {
	const unique = THINKING_EFFORT_LEVELS.filter((level) =>
		levels.includes(level),
	);
	return unique.length > 0 ? JSON.stringify(unique) : null;
}

export function parseDefaultThinkingEffort(
	raw: string | null | undefined,
	levels: ThinkingEffortLevel[],
): ThinkingEffortLevel | null {
	if (!raw?.trim()) return null;
	const result = thinkingEffortLevelSchema.safeParse(raw);
	if (!result.success) return null;
	return levels.includes(result.data) ? result.data : null;
}
