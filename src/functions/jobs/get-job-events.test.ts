import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createId } from "@/db/queries/helpers";
import { appendJobEvent, createJob } from "@/db/queries/jobs";
import * as schema from "@/db/schema";
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

	it("returns derived processing state and lease fields", async () => {
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
		const now = new Date();
		const recentHeartbeat = new Date(now.getTime() - 30_000).toISOString();
		const futureLease = new Date(now.getTime() + 60_000).toISOString();
		await testDb
			.update(schema.backgroundJobs)
			.set({
				workerId: "worker-1",
				processingStartedAt: recentHeartbeat,
				heartbeatAt: recentHeartbeat,
				leaseExpiresAt: futureLease,
				recoveryAttempts: 1,
			})
			.where(eq(schema.backgroundJobs.id, jobId));

		const response = await getJobEventsHandler(
			jobId,
			new Request(`http://localhost/api/jobs/${jobId}/events`),
			new Headers(),
		);
		const body = (await response.json()) as {
			processing?: {
				state?: string;
				heartbeatAt?: string | null;
				leaseExpiresAt?: string | null;
				recoveryAttempts?: number;
			};
		};

		expect(body.processing).toEqual({
			state: "active",
			heartbeatAt: recentHeartbeat,
			leaseExpiresAt: futureLease,
			recoveryAttempts: 1,
		});
	});
});
