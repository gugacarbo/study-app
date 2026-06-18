import { beforeEach, describe, expect, it, vi } from "vitest";
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
import {
	SSE_POLL_INTERVAL_MS,
	streamJobEventsHandler,
} from "@/functions/jobs/stream-job-events";

describe("streamJobEventsHandler", () => {
	beforeEach(() => {
		resetJobTestDb();
		vi.useFakeTimers();
	});

	it("returns an SSE response for a completed job", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const jobId = createId();
		await createJob(testDb, {
			id: jobId,
			userId: testUserId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.COMPLETED,
			metadata: serializeIngestJobMetadata({
				examId,
				modelId,
				mode: INGEST_MODE.CREATE,
			}),
		});

		const response = await streamJobEventsHandler(
			jobId,
			new Request(`http://localhost/api/jobs/${jobId}/stream`),
			new Headers(),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("text/event-stream");

		const reader = response.body?.getReader();
		expect(reader).toBeTruthy();
		const { value } = await reader!.read();
		const chunk = new TextDecoder().decode(value);
		expect(chunk).toContain("job-done");
		expect(chunk).toContain(JOB_STATUS.COMPLETED);
	});

	it("polls D1 while the job is running", async () => {
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

		const controller = new AbortController();
		const responsePromise = streamJobEventsHandler(
			jobId,
			new Request(`http://localhost/api/jobs/${jobId}/stream`, {
				signal: controller.signal,
			}),
			new Headers(),
		);

		await vi.advanceTimersByTimeAsync(SSE_POLL_INTERVAL_MS + 10);
		controller.abort();
		const response = await responsePromise;
		expect(response.headers.get("Content-Type")).toContain("text/event-stream");
	});
});
