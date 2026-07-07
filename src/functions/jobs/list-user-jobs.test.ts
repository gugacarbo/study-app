import { eq } from "drizzle-orm";
import type { D1Database } from "@cloudflare/workers-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "@/db/client";
import { createId } from "@/db/queries/helpers";
import { createJob } from "@/db/queries/jobs";
import * as schema from "@/db/schema";
import {
	otherUserId,
	resetJobTestDb,
	seedDefaultModel,
	seedExam,
	testDb,
	testUserId,
} from "@/functions/jobs/job-test-setup";
import { listUserJobsHandler } from "@/functions/jobs/list-user-jobs";
import {
	INGEST_MODE,
	JOB_KIND,
	JOB_STATUS,
	serializeImproveQuestionsJobMetadata,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";

vi.mock("@/functions/db", () => ({
	requireDB: vi.fn(async () => ({}) as D1Database),
}));

vi.mock("@/db/client", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/db/client")>();
	return {
		...original,
		createDb: vi.fn(() => testDb as AppDatabase),
	};
});

vi.mock("@/lib/rbac", () => ({
	requireSession: vi.fn(async () => ({
		user: { id: testUserId },
		session: { id: "session-1" },
	})),
}));

describe("listUserJobsHandler", () => {
	beforeEach(() => {
		resetJobTestDb();
	});

	it("returns a paginated slice of the authenticated user jobs", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		await seedDefaultModel(testDb, otherUserId);

		const olderJobId = createId();
		await createJob(testDb, {
			id: olderJobId,
			userId: testUserId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.COMPLETED,
			phase: "persisting",
			metadata: serializeIngestJobMetadata({
				examId,
				modelId,
				mode: INGEST_MODE.CREATE,
				fileName: "prova-antiga.txt",
			}),
		});

		const newerJobId = createId();
		await createJob(testDb, {
			id: newerJobId,
			userId: testUserId,
			kind: JOB_KIND.IMPROVE_QUESTIONS,
			status: JOB_STATUS.RUNNING,
			metadata: serializeImproveQuestionsJobMetadata({
				examId,
				modelId,
				writeExplanations: false,
				writeOptionExplanations: false,
				questionIds: [createId()],
				concurrencyLimit: 2,
				totalCount: 1,
				queuedCount: 0,
				runningCount: 1,
				completedCount: 0,
				failedCount: 0,
				cancelledCount: 0,
				pendingReviewCount: 0,
				items: [],
			}),
		});

		await createJob(testDb, {
			id: createId(),
			userId: otherUserId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.FAILED,
		});

		await testDb
			.update(schema.backgroundJobs)
			.set({
				createdAt: "2026-07-01 10:00:00",
				updatedAt: "2026-07-01 10:00:00",
			})
			.where(eq(schema.backgroundJobs.id, olderJobId));

		await testDb
			.update(schema.backgroundJobs)
			.set({
				createdAt: "2026-07-01 10:05:00",
				updatedAt: "2026-07-01 10:05:00",
			})
			.where(eq(schema.backgroundJobs.id, newerJobId));

		const page1 = await listUserJobsHandler(new Headers(), {
			page: 1,
			pageSize: 1,
		});
		const page2 = await listUserJobsHandler(new Headers(), {
			page: 2,
			pageSize: 1,
		});

		expect(page1.total).toBe(2);
		expect(page1.page).toBe(1);
		expect(page1.pageSize).toBe(1);
		expect(page1.rows).toHaveLength(1);
		expect(page1.rows[0]).toMatchObject({
			id: newerJobId,
			kind: JOB_KIND.IMPROVE_QUESTIONS,
			status: JOB_STATUS.RUNNING,
			title: "Melhoria de questões",
		});
		expect(page2.total).toBe(2);
		expect(page2.page).toBe(2);
		expect(page2.rows).toHaveLength(1);
		expect(page2.rows[0]).toMatchObject({
			id: olderJobId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.COMPLETED,
			phase: "persisting",
			title: "prova-antiga.txt",
		});
	});
});
