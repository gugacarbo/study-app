import { describe, expect, it, vi } from "vitest";
import { createPipelineLogReducer } from "@/features/ai/pipeline/client/pipeline-log-reducer";
import type { StudyAppDataUIPart } from "@/features/ai/lib/read-job-ui-message-stream";

describe("pipeline-log-reducer", () => {
	it("dedupes entries with the same timestamp and message in a short window", () => {
		vi.spyOn(Date, "now").mockReturnValue(1_000);

		const reducer = createPipelineLogReducer();
		reducer.append({
			timestamp: 42,
			level: "info",
			message: "Running review...",
		});
		reducer.append({
			timestamp: 42,
			level: "info",
			message: "Running review...",
		});

		expect(reducer.getState().logs).toHaveLength(1);
	});

	it("derives logs from stage and progress parts", () => {
		const reducer = createPipelineLogReducer();

		reducer.handleDataPart({
			type: "data-stage",
			data: {
				stageId: "review",
				label: "Review",
				status: "warning",
				timestamp: 10,
			},
		} as StudyAppDataUIPart);
		reducer.handleDataPart({
			type: "data-job-progress",
			data: { step: "Reviewing question 3", percent: 40, stageId: "review" },
		} as StudyAppDataUIPart);

		const { logs, stepText } = reducer.getState();
		expect(stepText).toBe("Reviewing question 3");
		expect(logs).toEqual([
			expect.objectContaining({
				level: "warning",
				message: "Review: warning",
				stageId: "review",
			}),
			expect.objectContaining({
				level: "info",
				message: "Reviewing question 3",
				stageId: "review",
			}),
		]);
	});
});
