import type { D1Database } from "@cloudflare/workers-types";
import type { AppDatabase } from "@/db/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createId } from "@/db/queries/helpers";
import { assignRoleToUser } from "@/db/queries/rbac";
import { createJob } from "@/db/queries/jobs";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import {
	cancelAdminJobHandler,
	getAdminJobDetailHandler,
	listAdminJobsHandler,
} from "@/functions/admin/jobs";
import { JOB_KIND, JOB_STATUS } from "@/lib/job-kinds";

const mockRequireAdminSession = vi.fn();
const mockCreateDb = vi.fn<() => AppDatabase>();

vi.mock("@/lib/rbac", () => ({
	requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

const testDb = createTestDb();
mockCreateDb.mockReturnValue(testDb);

vi.mock("@/functions/db", () => ({
	requireDB: vi.fn(async () => ({} as D1Database)),
}));

vi.mock("@/db/client", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/db/client")>();
	return {
		...original,
		createDb: () => mockCreateDb(),
	};
});

async function insertUser(db: AppDatabase, id = createId()) {
	const email = `user-${id}@aluno.ifsc.edu.br`;
	await db.insert(schema.user).values({
		id,
		name: "User",
		email,
		emailVerified: true,
	});
	return { id, email };
}

describe("admin jobs", () => {
	beforeEach(() => {
		mockRequireAdminSession.mockReset();
		mockCreateDb.mockReturnValue(testDb);
	});

	it("listAdminJobs returns jobs from all users", async () => {
		const adminId = createId();
		const owner = await insertUser(testDb);
		const jobId = createId();

		await insertUser(testDb, adminId);
		await assignRoleToUser(testDb, adminId, "admin");
		await createJob(testDb, {
			id: jobId,
			userId: owner.id,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.QUEUED,
		});

		mockRequireAdminSession.mockResolvedValue({ user: { id: adminId } });

		const jobs = await listAdminJobsHandler(new Headers());
		expect(jobs.find((job) => job.id === jobId)?.userEmail).toBe(owner.email);
	});

	it("getAdminJobDetail returns job and events", async () => {
		const adminId = createId();
		const owner = await insertUser(testDb);
		const jobId = createId();

		await insertUser(testDb, adminId);
		await createJob(testDb, {
			id: jobId,
			userId: owner.id,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.RUNNING,
		});

		mockRequireAdminSession.mockResolvedValue({ user: { id: adminId } });

		const detail = await getAdminJobDetailHandler(jobId, new Headers());
		expect(detail.id).toBe(jobId);
		expect(detail.userId).toBe(owner.id);
		expect(detail.events).toEqual([]);
	});

	it("getAdminJobDetail returns 404 for missing job", async () => {
		mockRequireAdminSession.mockResolvedValue({ user: { id: createId() } });

		await expect(
			getAdminJobDetailHandler(createId(), new Headers()),
		).rejects.toMatchObject({ status: 404 });
	});

	it("cancelAdminJob cancels another user's running job", async () => {
		const adminId = createId();
		const owner = await insertUser(testDb);
		const jobId = createId();

		await insertUser(testDb, adminId);
		await createJob(testDb, {
			id: jobId,
			userId: owner.id,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.RUNNING,
		});

		mockRequireAdminSession.mockResolvedValue({ user: { id: adminId } });

		const result = await cancelAdminJobHandler(jobId, new Headers());
		expect(result).toEqual({ ok: true, alreadyTerminal: false });

		const rows = await testDb
			.select()
			.from(schema.backgroundJobs)
			.where(eq(schema.backgroundJobs.id, jobId));
		expect(rows[0]?.cancelRequestedAt).toBeTruthy();
	});

	it("cancelAdminJob is no-op for completed job", async () => {
		const adminId = createId();
		const owner = await insertUser(testDb);
		const jobId = createId();

		await insertUser(testDb, adminId);
		await createJob(testDb, {
			id: jobId,
			userId: owner.id,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.COMPLETED,
		});

		mockRequireAdminSession.mockResolvedValue({ user: { id: adminId } });

		const result = await cancelAdminJobHandler(jobId, new Headers());
		expect(result).toEqual({ ok: true, alreadyTerminal: true });
	});
});
