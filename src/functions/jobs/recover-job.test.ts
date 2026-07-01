import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createId } from "@/db/queries/helpers";
import { createJob } from "@/db/queries/jobs";
import * as schema from "@/db/schema";
import {
	resetJobTestDb,
	seedUser,
	testDb,
	testUserId,
} from "@/functions/jobs/job-test-setup";
import { recoverStaleJobHandler } from "@/functions/jobs/recover-job";
import {
	JOB_KIND,
	JOB_STATUS,
} from "@/lib/job-kinds";

vi.mock("@/functions/queue", () => ({
	requireJobQueue: vi.fn(async () => ({
		send: vi.fn(),
	})),
	getJobQueue: vi.fn(async () => ({
		send: vi.fn(),
	})),
}));

describe("recoverStaleJobHandler", () => {
	beforeEach(() => {
		resetJobTestDb();
	});

	it("returns 404 when the job does not belong to the user", async () => {
		await seedUser(testDb, testUserId);

		const response = await recoverStaleJobHandler(createId(), new Headers());

		expect(response.status).toBe(404);
	});

	it("returns 409 when the job is not stale", async () => {
		await seedUser(testDb, testUserId);
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
				heartbeatAt: "2026-06-30T12:02:30.000Z",
				leaseExpiresAt: "2026-06-30T12:05:00.000Z",
			})
			.where(eq(schema.backgroundJobs.id, jobId));

		const response = await recoverStaleJobHandler(
			jobId,
			new Headers(),
			{ now: new Date("2026-06-30T12:03:00.000Z") },
		);

		expect(response.status).toBe(409);
	});

	it("requeues a stale running ingest job", async () => {
		await seedUser(testDb, testUserId);
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
				heartbeatAt: "2026-06-30T11:55:00.000Z",
				leaseExpiresAt: "2026-06-30T11:56:00.000Z",
				workerId: "worker-1",
			})
			.where(eq(schema.backgroundJobs.id, jobId));

		const response = await recoverStaleJobHandler(jobId, new Headers());

		expect(response.status).toBe(200);

		const [row] = await testDb
			.select()
			.from(schema.backgroundJobs)
			.where(eq(schema.backgroundJobs.id, jobId));
		expect(row?.status).toBe(JOB_STATUS.QUEUED);
	});
});
