import { describe, expect, it } from "vitest";
import {
	parseDefaultThinkingEffort,
	parseThinkingEffortLevels,
	serializeThinkingEffortLevels,
} from "#/db/queries/ai-model-thinking-effort";

describe("ai-model thinking effort helpers", () => {
	it("parses and serializes effort levels in canonical order", () => {
		const levels = parseThinkingEffortLevels('["high","low","invalid"]');
		expect(levels).toEqual(["low", "high"]);
		expect(serializeThinkingEffortLevels(levels)).toBe('["low","high"]');
	});

	it("parses default only when present in configured levels", () => {
		const levels = ["low", "medium"] as const;
		expect(parseDefaultThinkingEffort("medium", [...levels])).toBe("medium");
		expect(parseDefaultThinkingEffort("high", [...levels])).toBeNull();
	});
});
