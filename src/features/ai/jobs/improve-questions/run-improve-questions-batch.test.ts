import { describe, expect, it, vi } from "vitest";
import { createId } from "@/db/queries/helpers";
import type { ImproveQuestionsJobMetadata } from "@/lib/job-kinds";
import { JOB_STATUS } from "@/lib/job-kinds";
import { runImproveQuestionsBatch } from "@/features/ai/jobs/improve-questions/run-improve-questions-batch";

function createMetadata(questionIds: string[]): ImproveQuestionsJobMetadata {
	return {
		examId: createId(),
		modelId: createId(),
		writeExplanations: false,
		writeOptionExplanations: false,
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
				status: JOB_STATUS.FAILED,
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

	it("stops dispatching new questions when global cancellation is requested", async () => {
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

	it("cancels a running question when per-question cancellation is requested", async () => {
		const questionIds = [createId(), createId()];
		let questionCalls = 0;
		let secondQuestionCancelled = false;

		const executeQuestion = vi.fn(async ({ questionId }: { questionId: string }) => {
			questionCalls += 1;
			if (questionCalls === 2) {
				secondQuestionCancelled = true;
			}
			await Promise.resolve();
			return { summary: `ok:${questionId}` };
		});

		const updateJobStatus = vi.fn(async () => undefined);

		await runImproveQuestionsBatch({
			jobId: createId(),
			metadata: createMetadata(questionIds),
			deps: {
				appendJobEvent: async () => undefined,
				updateJobStatus,
				isCancelRequested: async () => false,
				isQuestionCancelled: async (questionId: string) => {
					return questionId === questionIds[1] && secondQuestionCancelled;
				},
				executeQuestion,
			},
		});

		expect(executeQuestion).toHaveBeenCalledTimes(2);
		const lastCall = updateJobStatus.mock.calls.at(-1) as
			| [string, { metadata?: ImproveQuestionsJobMetadata }]
			| undefined;
		const lastMetadata = lastCall?.[1].metadata;
		expect(lastMetadata?.cancelledCount).toBe(1);
		expect(lastMetadata?.completedCount).toBe(1);
		expect(
			lastMetadata?.items.find((i) => i.questionId === questionIds[1])?.status,
		).toBe("cancelled");
	});

	it("re-runs queued questions when metadata already contains retried items", async () => {
		const questionId = createId();
		const metadata = createMetadata([questionId]);
		metadata.items[0].status = "queued";
		metadata.items[0].retryAttempt = 1;

		const executeQuestion = vi.fn(async () => ({ summary: "ok" }));

		await runImproveQuestionsBatch({
			jobId: createId(),
			metadata,
			deps: {
				appendJobEvent: async () => undefined,
				updateJobStatus: async () => undefined,
				isCancelRequested: async () => false,
				executeQuestion,
			},
		});

		expect(executeQuestion).toHaveBeenCalledTimes(1);
	});

	it("runs the explanation agent after the improvement agent when enabled and emits completed only once", async () => {
		const questionId = createId();
		const appendJobEvent = vi.fn(async () => undefined);
		const updateJobStatus = vi.fn(async () => undefined);
		const executeQuestion = vi.fn(async () => ({ summary: "draft ok" }));
		const executeExplanations = vi.fn(async () => ({
			summary: "explanations ok",
			alerts: ["answer_mismatch"],
		}));

		await runImproveQuestionsBatch({
			jobId: createId(),
			metadata: {
				...createMetadata([questionId]),
				writeExplanations: true,
			},
			deps: {
				appendJobEvent,
				updateJobStatus,
				isCancelRequested: async () => false,
				executeQuestion,
				executeExplanations,
			},
		});

		expect(executeQuestion).toHaveBeenCalledWith({
			jobId: expect.any(String),
			questionId,
			writeOptionExplanations: false,
		});
		expect(executeExplanations).toHaveBeenCalledWith({
			jobId: expect.any(String),
			questionId,
		});
		expect(appendJobEvent).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				type: "data-improve-question-status",
				data: expect.objectContaining({
					questionId,
					status: "completed",
					summary: "explanations ok",
				}),
			}),
		);
		const eventCalls = appendJobEvent.mock.calls as unknown as Array<
			[string, unknown]
		>;
		expect(
			eventCalls.filter((call) => {
				const payload = call[1] as {
					type?: string;
					data?: { questionId?: string; status?: string };
				};
				return (
					payload.type === "data-improve-question-status" &&
					payload.data?.questionId === questionId &&
					payload.data?.status === "completed"
				);
			}),
		).toHaveLength(1);
		expect(updateJobStatus).toHaveBeenLastCalledWith(
			expect.any(String),
			expect.objectContaining({
				status: JOB_STATUS.COMPLETED,
				metadata: expect.objectContaining({
					items: [
						expect.objectContaining({
							questionId,
							status: "completed",
							stage: "saving_draft",
							summary: "explanations ok",
						}),
					],
				}),
			}),
		);
	});
});
