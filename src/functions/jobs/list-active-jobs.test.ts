import type { D1Database } from "@cloudflare/workers-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "@/db/client";
import { createId } from "@/db/queries/helpers";
import { createJob } from "@/db/queries/jobs";
import {
	resetJobTestDb,
	seedDefaultModel,
	seedExam,
	testDb,
	testUserId,
} from "@/functions/jobs/job-test-setup";
import { listActiveJobsHandler } from "@/functions/jobs/list-active-jobs";
import {
	INGEST_MODE,
	JOB_KIND,
	JOB_STATUS,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";

const mocks = vi.hoisted(() => ({
	testUserId: "00000000-0000-4000-8000-000000000091",
}));

vi.mock("@/lib/rbac", () => ({
	requireSession: vi.fn(async () => ({
		user: { id: mocks.testUserId },
		session: { id: "session-1" },
	})),
}));

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

describe("listActiveJobsHandler", () => {
	beforeEach(() => {
		resetJobTestDb();
	});

	it("returns active jobs for the authenticated user", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const jobId = createId();

		await createJob(testDb, {
			id: jobId,
			userId: testUserId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.RUNNING,
			phase: "extracting",
			metadata: serializeIngestJobMetadata({
				examId,
				modelId,
				mode: INGEST_MODE.CREATE,
				fileName: "prova-1.txt",
			}),
		});

		await createJob(testDb, {
			id: createId(),
			userId: testUserId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.COMPLETED,
		});

		const response = await listActiveJobsHandler(new Headers());
		expect(response.status).toBe(200);

		const body = (await response.json()) as {
			jobs?: Array<{
				id: string;
				status: string;
				phase: string | null;
				metadata: { fileName?: string };
			}>;
		};

		expect(body.jobs).toHaveLength(1);
		expect(body.jobs?.[0]).toEqual({
			id: jobId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.RUNNING,
			phase: "extracting",
			metadata: { fileName: "prova-1.txt" },
		});
	});

	it("returns null phase for awaiting_upload jobs", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const jobId = createId();

		await createJob(testDb, {
			id: jobId,
			userId: testUserId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.AWAITING_UPLOAD,
			metadata: serializeIngestJobMetadata({
				examId,
				modelId,
				mode: INGEST_MODE.CREATE,
			}),
		});

		const response = await listActiveJobsHandler(new Headers());
		const body = (await response.json()) as {
			jobs?: Array<{ id: string; phase: string | null }>;
		};

		expect(body.jobs).toHaveLength(1);
		expect(body.jobs?.[0]?.phase).toBeNull();
	});
});
