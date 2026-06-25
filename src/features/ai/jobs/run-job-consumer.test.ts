import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createId } from "@/db/queries/helpers";
import { createJob } from "@/db/queries/jobs";
import { createTestDb } from "@/db/test-db";
import * as schema from "@/db/schema";
import { runJobConsumer } from "@/features/ai/jobs/run-job-consumer";
import {
	JOB_KIND,
	JOB_STATUS,
	serializeImproveQuestionsJobMetadata,
} from "@/lib/job-kinds";

const runImproveQuestionsBatchMock = vi.fn();

vi.mock("@/features/ai/jobs/improve-questions/run-improve-questions-batch", () => ({
	runImproveQuestionsBatch: (input: unknown) => runImproveQuestionsBatchMock(input),
}));

describe("runJobConsumer", () => {
	beforeEach(() => {
		runImproveQuestionsBatchMock.mockReset();
	});

	it("dispatches improve-questions jobs to the batch runner", async () => {
		const db = createTestDb();
		const userId = createId();
		const examId = createId();
		const questionId = createId();
		const jobId = createId();

		await db.insert(schema.user).values({
			id: userId,
			name: "User",
			email: `${userId}@aluno.ifsc.edu.br`,
			emailVerified: true,
		});
		await db.insert(schema.exams).values({
			id: examId,
			userId,
			name: "Prova",
		});
		await db.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Pergunta",
			options: JSON.stringify([
				{ key: "A", text: "1" },
				{ key: "B", text: "2" },
			]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
		});
		await createJob(db, {
			id: jobId,
			userId,
			kind: JOB_KIND.IMPROVE_QUESTIONS,
			status: JOB_STATUS.QUEUED,
				metadata: serializeImproveQuestionsJobMetadata({
					examId,
					modelId: createId(),
					writeExplanations: false,
					questionIds: [questionId],
					concurrencyLimit: 2,
				totalCount: 1,
				queuedCount: 1,
				runningCount: 0,
				completedCount: 0,
				failedCount: 0,
				cancelledCount: 0,
				pendingReviewCount: 0,
				items: [
					{
						questionId,
						questionNumber: 1,
						status: "queued",
						stage: "queued",
					},
				],
			}),
		});

		const [job] = await db
			.select()
			.from(schema.backgroundJobs)
			.where(eq(schema.backgroundJobs.id, jobId));

		await runJobConsumer({
			db,
			env: { DB: {} as never, FILES_BUCKET: {} as never },
			job: job!,
		});

		expect(runImproveQuestionsBatchMock).toHaveBeenCalledWith(
			expect.objectContaining({
				jobId,
				metadata: expect.objectContaining({
					examId,
					questionIds: [questionId],
				}),
			}),
		);
	});
});
