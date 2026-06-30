import { describe, expect, it } from "vitest";
import { mergeImproveJobEvents } from "@/features/background-processes/lib/improve-event-mapper";
describe("mergeImproveJobEvents", () => {
	it("keeps the metadata terminal stage when replaying older stage events", () => {
		const metadata = {
			examId: "exam-1",
			modelId: "model-1",
			writeExplanations: true,
			questionIds: ["q-1"],
			concurrencyLimit: 1,
			totalCount: 1,
			queuedCount: 0,
			runningCount: 0,
			completedCount: 1,
			failedCount: 0,
			cancelledCount: 0,
			pendingReviewCount: 1,
			items: [
				{
					questionId: "q-1",
					questionNumber: 1,
					status: "completed" as const,
					stage: "saving_draft" as const,
				},
			],
		};

		const result = mergeImproveJobEvents({
			metadata,
			isJobTerminal: true,
			incoming: [
				{
					seq: 1,
					payload: {
						type: "data-improve-question-stage",
						data: { questionId: "q-1", stage: "saving_draft" },
					},
					createdAt: null,
				},
				{
					seq: 2,
					payload: {
						type: "data-improve-question-stage",
						data: { questionId: "q-1", stage: "writing_explanations" },
					},
					createdAt: null,
				},
			],
		});

		expect(result.questions[0]).toMatchObject({
			questionId: "q-1",
			status: "completed",
			stage: "saving_draft",
		});
	});
});
