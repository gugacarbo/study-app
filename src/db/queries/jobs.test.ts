import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createId } from "@/db/queries/helpers";
import {
	appendJobEvent,
	createJob,
	getJobById,
	hasActiveIngestJob,
	listJobEvents,
	listJobsForAdmin,
	requestJobCancelIfActive,
	setCancelRequested,
	updateJobStatus,
} from "@/db/queries/jobs";
import {
	INGEST_MODE,
	JOB_KIND,
	JOB_STATUS,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";

async function seedUser(db: ReturnType<typeof createTestDb>, userId: string) {
	await db.insert(schema.user).values({
		id: userId,
		name: "User",
		email: `${userId}@aluno.ifsc.edu.br`,
		emailVerified: true,
	});
}

describe("jobs queries", () => {
	it("getJobById returns null for another user", async () => {
		const db = createTestDb();
		const ownerId = createId();
		const otherId = createId();
		const jobId = createId();
		const examId = createId();

		await seedUser(db, ownerId);
		await seedUser(db, otherId);
		await createJob(db, {
			id: jobId,
			userId: ownerId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.AWAITING_UPLOAD,
			metadata: {
				examId,
				modelId: createId(),
				mode: INGEST_MODE.CREATE,
			},
		});

		expect(await getJobById(db, jobId, ownerId)).not.toBeNull();
		expect(await getJobById(db, jobId, otherId)).toBeNull();
	});

	it("appendJobEvent assigns monotonic seq per job", async () => {
		const db = createTestDb();
		const userId = createId();
		const jobId = createId();

		await seedUser(db, userId);
		await createJob(db, {
			id: jobId,
			userId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.QUEUED,
		});

		const first = await appendJobEvent(db, jobId, { type: "data-ingest-phase" });
		const second = await appendJobEvent(db, jobId, {
			type: "data-ingest-stream-progress",
			questionsSeen: 1,
		});

		expect(first.seq).toBe(1);
		expect(second.seq).toBe(2);

		const events = await listJobEvents(db, jobId, 0);
		expect(events.map((event) => event.seq)).toEqual([1, 2]);
	});

	it("listJobEvents returns only events after afterSeq", async () => {
		const db = createTestDb();
		const userId = createId();
		const jobId = createId();

		await seedUser(db, userId);
		await createJob(db, {
			id: jobId,
			userId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.RUNNING,
		});

		await appendJobEvent(db, jobId, { n: 1 });
		await appendJobEvent(db, jobId, { n: 2 });
		await appendJobEvent(db, jobId, { n: 3 });

		const tail = await listJobEvents(db, jobId, 1);
		expect(tail).toHaveLength(2);
		expect(tail.map((event) => event.seq)).toEqual([2, 3]);
	});

	it("updateJobStatus patches status, phase, error, and metadata", async () => {
		const db = createTestDb();
		const userId = createId();
		const jobId = createId();
		const examId = createId();
		const modelId = createId();

		await seedUser(db, userId);
		await createJob(db, {
			id: jobId,
			userId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.AWAITING_UPLOAD,
			metadata: {
				examId,
				modelId,
				mode: INGEST_MODE.CREATE,
			},
		});

		await updateJobStatus(db, jobId, {
			status: JOB_STATUS.RUNNING,
			phase: "extracting",
			metadata: {
				examId,
				modelId,
				mode: INGEST_MODE.CREATE,
				extractedCount: 3,
			},
		});

		const job = await getJobById(db, jobId, userId);
		expect(job?.status).toBe(JOB_STATUS.RUNNING);
		expect(job?.phase).toBe("extracting");
		expect(job?.metadata).toContain('"extractedCount":3');
	});

	it("setCancelRequested sets cancel_requested_at", async () => {
		const db = createTestDb();
		const userId = createId();
		const jobId = createId();

		await seedUser(db, userId);
		await createJob(db, {
			id: jobId,
			userId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.RUNNING,
		});

		await setCancelRequested(db, jobId);
		const job = await getJobById(db, jobId, userId);
		expect(job?.cancelRequestedAt).not.toBeNull();
	});

	it("requestJobCancelIfActive finalizes queued jobs immediately", async () => {
		const db = createTestDb();
		const userId = createId();
		const jobId = createId();

		await seedUser(db, userId);
		await createJob(db, {
			id: jobId,
			userId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.QUEUED,
		});

		const job = await getJobById(db, jobId, userId);
		expect(job).not.toBeNull();

		const result = await requestJobCancelIfActive(db, job!);
		expect(result).toEqual({ cancelled: true, alreadyTerminal: false });

		const updated = await getJobById(db, jobId, userId);
		expect(updated?.status).toBe(JOB_STATUS.CANCELLED);
		expect(updated?.cancelRequestedAt).not.toBeNull();
	});

	it("requestJobCancelIfActive only flags running jobs for consumer", async () => {
		const db = createTestDb();
		const userId = createId();
		const jobId = createId();

		await seedUser(db, userId);
		await createJob(db, {
			id: jobId,
			userId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.RUNNING,
		});

		const job = await getJobById(db, jobId, userId);
		const result = await requestJobCancelIfActive(db, job!);
		expect(result).toEqual({ cancelled: true, alreadyTerminal: false });

		const updated = await getJobById(db, jobId, userId);
		expect(updated?.status).toBe(JOB_STATUS.RUNNING);
		expect(updated?.cancelRequestedAt).not.toBeNull();
	});

	it("hasActiveIngestJob detects active ingest on same exam", async () => {
		const db = createTestDb();
		const userId = createId();
		const examId = createId();
		const modelId = createId();

		await seedUser(db, userId);

		expect(await hasActiveIngestJob(db, userId, examId)).toBe(false);

		await createJob(db, {
			id: createId(),
			userId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.QUEUED,
			metadata: serializeIngestJobMetadata({
				examId,
				modelId,
				mode: INGEST_MODE.APPEND,
			}),
		});

		expect(await hasActiveIngestJob(db, userId, examId)).toBe(true);
	});

	it("hasActiveIngestJob ignores completed jobs on same exam", async () => {
		const db = createTestDb();
		const userId = createId();
		const examId = createId();

		await seedUser(db, userId);
		await createJob(db, {
			id: createId(),
			userId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.COMPLETED,
			metadata: serializeIngestJobMetadata({
				examId,
				modelId: createId(),
				mode: INGEST_MODE.CREATE,
			}),
		});

		expect(await hasActiveIngestJob(db, userId, examId)).toBe(false);
	});

	it("listJobsForAdmin returns jobs ordered by created_at desc with user email", async () => {
		const db = createTestDb();
		const userA = createId();
		const userB = createId();
		const jobOlder = createId();
		const jobNewer = createId();

		await seedUser(db, userA);
		await db.insert(schema.user).values({
			id: userB,
			name: "Other",
			email: `other-${userB}@aluno.ifsc.edu.br`,
			emailVerified: true,
		});

		await createJob(db, {
			id: jobOlder,
			userId: userA,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.COMPLETED,
		});
		await db
			.update(schema.backgroundJobs)
			.set({ createdAt: "2020-01-01T00:00:00.000Z" })
			.where(eq(schema.backgroundJobs.id, jobOlder));

		await createJob(db, {
			id: jobNewer,
			userId: userB,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.RUNNING,
		});

		const jobs = await listJobsForAdmin(db);
		expect(jobs).toHaveLength(2);
		expect(jobs[0]?.id).toBe(jobNewer);
		expect(jobs[1]?.id).toBe(jobOlder);
		expect(jobs[0]?.userEmail).toBe(`other-${userB}@aluno.ifsc.edu.br`);
	});
});
