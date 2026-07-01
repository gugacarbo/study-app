import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createId } from "@/db/queries/helpers";
import { createJob } from "@/db/queries/jobs";
import * as schema from "@/db/schema";
import { resetJobTestDb, seedUser, testDb, testUserId } from "@/functions/jobs/job-test-setup";
import { reconcileStaleJobs } from "@/functions/jobs/reconcile-stale-jobs";
import {
	IMPROVE_BATCH_PHASE,
	JOB_KIND,
	JOB_STATUS,
	serializeImproveQuestionsJobMetadata,
} from "@/lib/job-kinds";

describe("reconcileStaleJobs", () => {
	beforeEach(async () => {
		resetJobTestDb();
		await seedUser(testDb, testUserId);
	});

	it("requeues stale queued jobs", async () => {
		const jobId = createId();
		const send = vi.fn();

		await createJob(testDb, {
			id: jobId,
			userId: testUserId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.QUEUED,
		});
		await testDb
			.update(schema.backgroundJobs)
			.set({ updatedAt: "2026-06-30T12:00:00.000Z" })
			.where(eq(schema.backgroundJobs.id, jobId));

		const result = await reconcileStaleJobs(testDb, {
			queue: { send } as never,
			now: new Date("2026-06-30T12:03:00.000Z"),
		});

		expect(result).toEqual(
			expect.objectContaining({
				requeued: 1,
			}),
		);
		expect(send).toHaveBeenCalledWith({ jobId });
	});

	it("cancels stale running jobs with pending cancellation", async () => {
		const jobId = createId();

		await createJob(testDb, {
			id: jobId,
			userId: testUserId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.RUNNING,
		});
		await testDb
			.update(schema.backgroundJobs)
			.set({
				cancelRequestedAt: "2026-06-30T12:00:00.000Z",
				leaseExpiresAt: "2026-06-30T12:01:00.000Z",
			})
			.where(eq(schema.backgroundJobs.id, jobId));

		const result = await reconcileStaleJobs(testDb, {
			queue: { send: vi.fn() } as never,
			now: new Date("2026-06-30T12:03:00.000Z"),
		});

		expect(result.cancelled).toBe(1);
		const [row] = await testDb
			.select()
			.from(schema.backgroundJobs)
			.where(eq(schema.backgroundJobs.id, jobId));
		expect(row?.status).toBe(JOB_STATUS.CANCELLED);
	});

	it("resets improve-questions running items before requeue", async () => {
		const jobId = createId();
		const questionId = createId();
		const send = vi.fn();

		await createJob(testDb, {
			id: jobId,
			userId: testUserId,
			kind: JOB_KIND.IMPROVE_QUESTIONS,
			status: JOB_STATUS.RUNNING,
			phase: IMPROVE_BATCH_PHASE.PROCESSING_QUESTIONS,
			metadata: serializeImproveQuestionsJobMetadata({
				examId: createId(),
				modelId: createId(),
				writeExplanations: false,
				writeOptionExplanations: false,
				questionIds: [questionId],
				concurrencyLimit: 1,
				totalCount: 1,
				queuedCount: 0,
				runningCount: 1,
				completedCount: 0,
				failedCount: 0,
				cancelledCount: 0,
				pendingReviewCount: 0,
				items: [
					{
						questionId,
						questionNumber: 1,
						status: "running",
						stage: "drafting",
					},
				],
			}),
		});
		await testDb
			.update(schema.backgroundJobs)
			.set({
				leaseExpiresAt: "2026-06-30T12:01:00.000Z",
				workerId: "worker-1",
			})
			.where(eq(schema.backgroundJobs.id, jobId));

		await reconcileStaleJobs(testDb, {
			queue: { send } as never,
			now: new Date("2026-06-30T12:03:00.000Z"),
		});

		const [row] = await testDb
			.select()
			.from(schema.backgroundJobs)
			.where(eq(schema.backgroundJobs.id, jobId));
		const metadata = JSON.parse(row?.metadata ?? "{}") as {
			queuedCount: number;
			runningCount: number;
			items: Array<{ status: string }>;
		};

		expect(row?.status).toBe(JOB_STATUS.QUEUED);
		expect(metadata.queuedCount).toBe(1);
		expect(metadata.runningCount).toBe(0);
		expect(metadata.items[0]?.status).toBe("queued");
		expect(send).toHaveBeenCalledWith({ jobId });
	});
});
