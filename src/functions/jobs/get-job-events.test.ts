import { beforeEach, describe, expect, it } from "vitest";
import { createId } from "@/db/queries/helpers";
import { appendJobEvent, createJob } from "@/db/queries/jobs";
import {
	resetJobTestDb,
	seedDefaultModel,
	seedExam,
	testDb,
	testUserId,
} from "@/functions/jobs/job-test-setup";
import { getJobEventsHandler } from "@/functions/jobs/get-job-events";
import {
	INGEST_MODE,
	JOB_KIND,
	JOB_STATUS,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";

describe("getJobEventsHandler", () => {
	beforeEach(() => {
		resetJobTestDb();
	});

	it("returns 404 for unknown job", async () => {
		const response = await getJobEventsHandler(
			createId(),
			new Request("http://localhost/api/jobs/x/events"),
			new Headers(),
		);
		expect(response.status).toBe(404);
	});

	it("returns events after the given sequence", async () => {
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
		await appendJobEvent(testDb, jobId, JSON.stringify({ type: "first" }));
		await appendJobEvent(testDb, jobId, JSON.stringify({ type: "second" }));

		const response = await getJobEventsHandler(
			jobId,
			new Request(`http://localhost/api/jobs/${jobId}/events?after=1`),
			new Headers(),
		);
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			status?: string;
			events?: Array<{ payload?: { type?: string } }>;
		};
		expect(body.status).toBe(JOB_STATUS.RUNNING);
		expect(body.events).toHaveLength(1);
		expect(body.events?.[0]?.payload).toEqual({ type: "second" });
	});
});
