import { beforeEach, describe, expect, it } from "vitest";
import {
	otherUserId,
	resetJobTestDb,
	seedDefaultModel,
	seedExam,
	seedUser,
	testDb,
	testUserId,
} from "@/functions/jobs/job-test-setup";
import { createJob } from "@/db/queries/jobs";
import {
	INGEST_MODE,
	JOB_KIND,
	JOB_STATUS,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";
import { createId } from "@/db/queries/helpers";
import { createIngestJobHandler } from "@/functions/jobs/create-ingest-job";

describe("createIngestJobHandler", () => {
	beforeEach(() => {
		resetJobTestDb();
	});

	it("returns 400 when name and examId are both missing", async () => {
		const response = await createIngestJobHandler(
			{ kind: "ingest" },
			new Headers(),
		);
		expect(response.status).toBe(400);
	});

	it("returns 400 when name and examId are both provided", async () => {
		await seedDefaultModel(testDb, testUserId);
		const response = await createIngestJobHandler(
			{
				kind: "ingest",
				name: "Nova prova",
				examId: "00000000-0000-4000-8000-000000000001",
			},
			new Headers(),
		);
		expect(response.status).toBe(400);
	});

	it("returns 400 when no AI model is available", async () => {
		await seedUser(testDb, testUserId);
		const response = await createIngestJobHandler(
			{ kind: "ingest", name: "Nova prova" },
			new Headers(),
		);
		expect(response.status).toBe(400);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe("model_unavailable");
	});

	it("creates exam and job in create mode", async () => {
		await seedDefaultModel(testDb, testUserId);
		const response = await createIngestJobHandler(
			{ kind: "ingest", name: "Prova de Cálculo" },
			new Headers(),
		);
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			jobId?: string;
			examId?: string;
		};
		expect(body.examId).toBeTruthy();
	});

	it("returns 404 for append on another user's exam", async () => {
		await seedDefaultModel(testDb, testUserId);
		await seedUser(testDb, otherUserId);
		const otherExamId = await seedExam(testDb, otherUserId);
		const response = await createIngestJobHandler(
			{ kind: "ingest", examId: otherExamId },
			new Headers(),
		);
		expect(response.status).toBe(404);
	});

	it("returns 409 when an active ingest job exists for the exam", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		await createJob(testDb, {
			id: createId(),
			userId: testUserId,
			kind: JOB_KIND.INGEST,
			status: JOB_STATUS.RUNNING,
			metadata: serializeIngestJobMetadata({
				examId,
				modelId,
				mode: INGEST_MODE.APPEND,
			}),
		});

		const response = await createIngestJobHandler(
			{ kind: "ingest", examId },
			new Headers(),
		);
		expect(response.status).toBe(409);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe("active_job_conflict");
	});
});
