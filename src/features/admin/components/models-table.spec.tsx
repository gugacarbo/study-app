import { describe, expect, it } from "vitest";
import { getModelStatusBadge, type ModelRow } from "@/features/admin/components/models-table";

const baseModel: ModelRow = {
	id: "model-1",
	providerId: "provider-1",
	modelId: "gpt-5",
	displayName: "GPT-5",
	enabled: true,
	contextWindow: null,
	maxOutputTokens: null,
	inputCostPerMillion: null,
	outputCostPerMillion: null,
	thinkingEffortLevels: null,
	defaultThinkingEffort: null,
		thinkingEnabled: null,
		thinkingParamName: null,
		healthStatus: null,
		metadata: null,
		requestParams: null,
	createdAt: "2026-06-23T00:00:00.000Z",
	updatedAt: "2026-06-23T00:00:00.000Z",
};

describe("getModelStatusBadge", () => {
	it("returns Active when the latest test succeeded", () => {
		expect(
			getModelStatusBadge({ ...baseModel, healthStatus: "active" }),
		).toEqual({
			label: "Active",
			variant: "outline",
			className:
				"border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/40 dark:text-emerald-300",
		});
	});

	it("returns Offline when the latest test failed", () => {
		expect(
			getModelStatusBadge({ ...baseModel, healthStatus: "offline" }),
		).toEqual({
			label: "Offline",
			variant: "outline",
			className:
				"border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/80 dark:bg-rose-950/40 dark:text-rose-300",
		});
	});

	it("falls back to Offline before any test result", () => {
		expect(getModelStatusBadge(baseModel)).toEqual({
			label: "Offline",
			variant: "outline",
			className:
				"border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/80 dark:bg-rose-950/40 dark:text-rose-300",
		});
	});
});
