import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createId } from "@/db/queries/helpers";
import { createJob } from "@/db/queries/jobs";
import * as schema from "@/db/schema";
import { cancelJobHandler } from "@/functions/jobs/cancel-job";
import {
	resetJobTestDb,
	seedDefaultModel,
	seedExam,
	testDb,
	testUserId,
} from "@/functions/jobs/job-test-setup";
import {
	INGEST_MODE,
	JOB_KIND,
	JOB_STATUS,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";

describe("cancelJobHandler", () => {
	beforeEach(() => {
		resetJobTestDb();
	});

	it("returns 404 for unknown job", async () => {
		const response = await cancelJobHandler(createId(), new Headers());
		expect(response.status).toBe(404);
	});

	it("sets cancel_requested_at for a running job", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const jobId = createId();
		await createJob(testDb, {
			id: jobId,
			userId: testUserId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.RUNNING,
			metadata: serializeIngestJobMetadata({
				examId,
				modelId,
				mode: INGEST_MODE.CREATE,
			}),
		});

		const response = await cancelJobHandler(jobId, new Headers());
		expect(response.status).toBe(200);

		const rows = await testDb
			.select()
			.from(schema.backgroundJobs)
			.where(eq(schema.backgroundJobs.id, jobId));
		expect(rows[0]?.cancelRequestedAt).toBeTruthy();
	});

	it("cancels a queued job immediately", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const jobId = createId();
		await createJob(testDb, {
			id: jobId,
			userId: testUserId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.QUEUED,
			metadata: serializeIngestJobMetadata({
				examId,
				modelId,
				mode: INGEST_MODE.CREATE,
			}),
		});

		const response = await cancelJobHandler(jobId, new Headers());
		expect(response.status).toBe(200);

		const rows = await testDb
			.select()
			.from(schema.backgroundJobs)
			.where(eq(schema.backgroundJobs.id, jobId));
		expect(rows[0]?.status).toBe(JOB_STATUS.CANCELLED);
		expect(rows[0]?.cancelRequestedAt).toBeTruthy();
	});
});
