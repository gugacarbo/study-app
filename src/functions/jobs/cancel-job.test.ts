import { beforeEach, describe, expect, it } from "vitest";
import {
	resetJobTestDb,
	seedDefaultModel,
	seedExam,
	testDb,
	testUserId,
} from "@/functions/jobs/job-test-setup";
import { createJob } from "@/db/queries/jobs";
import { createId } from "@/db/queries/helpers";
import {
	INGEST_MODE,
	JOB_KIND,
	JOB_STATUS,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";
import { cancelJobHandler } from "@/functions/jobs/cancel-job";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

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
});
