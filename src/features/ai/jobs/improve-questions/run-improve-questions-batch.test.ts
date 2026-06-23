import { describe, expect, it, vi } from "vitest";
import { createId } from "@/db/queries/helpers";
import type { ImproveQuestionsJobMetadata } from "@/lib/job-kinds";
import { JOB_STATUS } from "@/lib/job-kinds";
import { runImproveQuestionsBatch } from "@/features/ai/jobs/improve-questions/run-improve-questions-batch";

function createMetadata(questionIds: string[]): ImproveQuestionsJobMetadata {
	return {
		examId: createId(),
		modelId: createId(),
		questionIds,
		concurrencyLimit: 2,
		totalCount: questionIds.length,
		queuedCount: questionIds.length,
		runningCount: 0,
		completedCount: 0,
		failedCount: 0,
		cancelledCount: 0,
		pendingReviewCount: 0,
		items: questionIds.map((questionId, index) => ({
			questionId,
			questionNumber: index + 1,
			status: "queued",
			stage: "queued",
		})),
	};
}

describe("runImproveQuestionsBatch", () => {
	it("respects concurrency limit and completes the batch with partial failures", async () => {
		const questionIds = [createId(), createId(), createId()];
		const running: string[] = [];
		let maxParallel = 0;

		const updateJobStatus = vi.fn(async () => undefined);
		const appendJobEvent = vi.fn(async () => undefined);

		const executeQuestion = vi.fn(
			async ({ questionId }: { questionId: string }) => {
				running.push(questionId);
				maxParallel = Math.max(maxParallel, running.length);
				await Promise.resolve();
				running.splice(running.indexOf(questionId), 1);

				if (questionId === questionIds[1]) {
					throw new Error("boom");
				}

				return {
					summary: `ok:${questionId}`,
				};
			},
		);

		await runImproveQuestionsBatch({
			jobId: createId(),
			metadata: createMetadata(questionIds),
			deps: {
				appendJobEvent,
				updateJobStatus,
				isCancelRequested: async () => false,
				executeQuestion,
			},
		});

		expect(executeQuestion).toHaveBeenCalledTimes(3);
		expect(maxParallel).toBeLessThanOrEqual(2);
		expect(updateJobStatus).toHaveBeenLastCalledWith(
			expect.any(String),
			expect.objectContaining({
				status: JOB_STATUS.COMPLETED,
				phase: "finalizing_batch",
				metadata: expect.objectContaining({
					queuedCount: 0,
					runningCount: 0,
					completedCount: 2,
					failedCount: 1,
					pendingReviewCount: 2,
					items: expect.arrayContaining([
						expect.objectContaining({
							questionId: questionIds[0],
							status: "completed",
							stage: "saving_draft",
						}),
						expect.objectContaining({
							questionId: questionIds[1],
							status: "failed",
						}),
						expect.objectContaining({
							questionId: questionIds[2],
							status: "completed",
							stage: "saving_draft",
						}),
					]),
				}),
			}),
		);
		expect(appendJobEvent).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				type: "data-improve-batch-phase",
				data: { phase: "preparing_batch" },
			}),
		);
		expect(appendJobEvent).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				type: "data-improve-question-status",
				data: expect.objectContaining({
					questionId: questionIds[1],
					status: "failed",
					error: "boom",
				}),
			}),
		);
	});

	it("stops dispatching new questions when cancellation is requested", async () => {
		const questionIds = [createId(), createId(), createId()];
		const executeQuestion = vi.fn(async () => ({ summary: "ok" }));
		let cancelChecks = 0;

		await runImproveQuestionsBatch({
			jobId: createId(),
			metadata: createMetadata(questionIds),
			deps: {
				appendJobEvent: async () => undefined,
				updateJobStatus: async () => undefined,
				isCancelRequested: async () => {
					cancelChecks += 1;
					return cancelChecks > 1;
				},
				executeQuestion,
			},
		});

		expect(executeQuestion).toHaveBeenCalledTimes(1);
	});
});
