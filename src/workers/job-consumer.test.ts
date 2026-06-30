import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "@/db/client";
import { createId } from "@/db/queries/helpers";
import { createJob } from "@/db/queries/jobs";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { JOB_KIND, JOB_STATUS } from "@/lib/job-kinds";
import { handleJobConsumer } from "@/workers/job-consumer";

const runJobConsumerMock = vi.fn();
const mockCreateDb = vi.fn<() => AppDatabase>();

vi.mock("@/features/ai/jobs/run-job-consumer", () => ({
	runJobConsumer: (input: unknown) => runJobConsumerMock(input),
}));

vi.mock("@/db/client", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/db/client")>();
	return {
		...original,
		createDb: () => mockCreateDb(),
	};
});

describe("handleJobConsumer", () => {
	beforeEach(() => {
		runJobConsumerMock.mockReset();
	});

	it("claims a queued job before dispatching to the runner", async () => {
		const db = createTestDb();
		const userId = createId();
		const jobId = createId();
		mockCreateDb.mockReturnValue(db);

		await db.insert(schema.user).values({
			id: userId,
			name: "User",
			email: `${userId}@aluno.ifsc.edu.br`,
			emailVerified: true,
		});
		await createJob(db, {
			id: jobId,
			userId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.QUEUED,
		});

		const ack = vi.fn();
		await handleJobConsumer(
			{
				messages: [
					{
						id: "msg-1",
						body: { jobId },
						ack,
						retry: vi.fn(),
					},
				],
			} as never,
			{
				DB: {} as never,
				FILES_BUCKET: {} as never,
			},
			{} as ExecutionContext,
		);

		expect(runJobConsumerMock).toHaveBeenCalledWith(
			expect.objectContaining({
				job: expect.objectContaining({
					id: jobId,
					status: JOB_STATUS.RUNNING,
				}),
			}),
		);
		expect(ack).toHaveBeenCalled();
	});
});
