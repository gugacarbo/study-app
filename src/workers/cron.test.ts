import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "@/db/client";
import type { Queue, R2Bucket } from "@cloudflare/workers-types";
import { JOB_RECOVERY_CRON } from "@/lib/job-processing";
import { handleScheduled } from "@/workers/cron";

const hoisted = vi.hoisted(() => ({
	reconcileStaleJobsMock: vi.fn(),
	purgeExpiredBlobsMock: vi.fn(),
	mockCreateDb: vi.fn<(...args: unknown[]) => AppDatabase>(),
}));

vi.mock("@/functions/jobs/reconcile-stale-jobs", () => ({
	reconcileStaleJobs: (db: AppDatabase, input: { queue: Queue<unknown> }) =>
		hoisted.reconcileStaleJobsMock(db, input),
}));

vi.mock("@/functions/storage/purge-expired-blobs", () => ({
	purgeExpiredBlobs: (env: unknown) => hoisted.purgeExpiredBlobsMock(env),
}));

vi.mock("@/db/client", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/db/client")>();
	return {
		...original,
		createDb: (...args: unknown[]) => hoisted.mockCreateDb(...args),
	};
});

describe("handleScheduled", () => {
	beforeEach(() => {
		hoisted.reconcileStaleJobsMock.mockReset();
		hoisted.purgeExpiredBlobsMock.mockReset();
		hoisted.mockCreateDb.mockReset();
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	function buildEnv(
		options: { jobQueue?: boolean } = {},
	): { DB: never; JOB_QUEUE?: Queue<unknown>; FILES_BUCKET: R2Bucket } {
		return {
			DB: {} as never,
			FILES_BUCKET: {} as R2Bucket,
			...(options.jobQueue
				? { JOB_QUEUE: { send: vi.fn() } as unknown as Queue<unknown> }
				: {}),
		};
	}

	it("runs job recovery on the recovery cron and logs metrics", async () => {
		const db = {} as AppDatabase;
		const env = buildEnv({ jobQueue: true });
		hoisted.mockCreateDb.mockReturnValue(db);
		hoisted.reconcileStaleJobsMock.mockResolvedValue({
			requeued: 2,
			cancelled: 1,
			failed: 0,
		});

		await handleScheduled(
			{ cron: JOB_RECOVERY_CRON, scheduledTime: Date.now() } as ScheduledEvent,
			env,
			{} as ExecutionContext,
		);

		expect(hoisted.mockCreateDb).toHaveBeenCalledWith(env.DB);
		expect(hoisted.reconcileStaleJobsMock).toHaveBeenCalledWith(db, {
			queue: env.JOB_QUEUE,
		});
		expect(hoisted.purgeExpiredBlobsMock).not.toHaveBeenCalled();
		expect(console.log).toHaveBeenCalledWith(
			"[cron] starting job recovery reconcile",
			expect.any(Object),
		);
		expect(console.log).toHaveBeenCalledWith(
			"[cron] job recovery reconcile finished",
			expect.objectContaining({ requeued: 2, cancelled: 1, failed: 0 }),
		);
	});

	it("skips job recovery when JOB_QUEUE binding is missing", async () => {
		await handleScheduled(
			{ cron: JOB_RECOVERY_CRON, scheduledTime: Date.now() } as ScheduledEvent,
			buildEnv(),
			{} as ExecutionContext,
		);

		expect(hoisted.reconcileStaleJobsMock).not.toHaveBeenCalled();
		expect(hoisted.purgeExpiredBlobsMock).not.toHaveBeenCalled();
		expect(console.warn).toHaveBeenCalledWith(
			"[cron] JOB_QUEUE binding missing; skipping stale job reconciliation",
		);
	});

	it("logs errors but does not throw when reconcile fails", async () => {
		const env = buildEnv({ jobQueue: true });
		hoisted.mockCreateDb.mockReturnValue({} as AppDatabase);
		hoisted.reconcileStaleJobsMock.mockRejectedValue(new Error("db down"));

		await expect(
			handleScheduled(
				{
					cron: JOB_RECOVERY_CRON,
					scheduledTime: Date.now(),
				} as ScheduledEvent,
				env,
				{} as ExecutionContext,
			),
		).resolves.toBeUndefined();

		expect(console.error).toHaveBeenCalledWith(
			"[cron] job recovery reconcile failed",
			expect.any(Error),
		);
		expect(hoisted.purgeExpiredBlobsMock).not.toHaveBeenCalled();
	});

	it("runs purge for non-recovery crons", async () => {
		const env = buildEnv();

		await handleScheduled(
			{ cron: "0 4 * * *", scheduledTime: Date.now() } as ScheduledEvent,
			env,
			{} as ExecutionContext,
		);

		expect(hoisted.reconcileStaleJobsMock).not.toHaveBeenCalled();
		expect(hoisted.purgeExpiredBlobsMock).toHaveBeenCalledWith(env);
	});
});
