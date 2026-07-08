import { beforeEach, describe, expect, it } from "vitest";
import { createId } from "@/db/queries/helpers";
import { createJob } from "@/db/queries/jobs";
import * as schema from "@/db/schema";
import {
	resetJobTestDb,
	seedDefaultModel,
	seedExam,
	seedUser,
	testDb,
	testUserId,
} from "@/functions/jobs/job-test-setup";
import { createGenerateExamJobHandler } from "@/functions/jobs/create-generate-exam-job";
import {
	GENERATE_EXAM_DIFFICULTY,
	JOB_KIND,
	JOB_STATUS,
	serializeGenerateExamJobMetadata,
} from "@/lib/job-kinds";

const GENERATED_EXAM_SOURCE = "Gerada por IA";

describe("createGenerateExamJobHandler", () => {
	beforeEach(() => {
		resetJobTestDb();
	});

	it("creates exam and job with submitted title", async () => {
		await seedDefaultModel(testDb, testUserId);
		const response = await createGenerateExamJobHandler(
			{
				kind: "generate-exam",
				title: "Prova de Cálculo I",
				questionCount: 5,
				difficulty: "medium",
			},
			new Headers(),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			jobId?: string;
			examId?: string;
		};
		expect(body.jobId).toBeTruthy();
		expect(body.examId).toBeTruthy();

		const exams = await testDb.select().from(schema.exams);
		expect(exams).toHaveLength(1);
		expect(exams[0]?.name).toBe("Prova de Cálculo I");
		expect(exams[0]?.source).toBe(GENERATED_EXAM_SOURCE);

		const jobs = await testDb.select().from(schema.backgroundJobs);
		expect(jobs).toHaveLength(1);
		expect(jobs[0]?.kind).toBe(JOB_KIND.GENERATE_EXAM);
		expect(jobs[0]?.status).toBe(JOB_STATUS.AWAITING_UPLOAD);
	});

	it("returns 400 when no AI model is available", async () => {
		await seedUser(testDb, testUserId);
		const response = await createGenerateExamJobHandler(
			{
				kind: "generate-exam",
				title: "Prova",
				questionCount: 5,
				difficulty: "easy",
			},
			new Headers(),
		);

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe("model_unavailable");
	});

	it("returns 400 for invalid payload", async () => {
		await seedDefaultModel(testDb, testUserId);
		const response = await createGenerateExamJobHandler(
			{
				kind: "generate-exam",
				title: "",
				questionCount: 25,
				difficulty: "invalid",
			},
			new Headers(),
		);

		expect(response.status).toBe(400);
	});

	it("blocks active generate-exam job on the same exam", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		await createJob(testDb, {
			id: createId(),
			userId: testUserId,
			kind: JOB_KIND.GENERATE_EXAM,
			status: JOB_STATUS.RUNNING,
			metadata: serializeGenerateExamJobMetadata({
				examId,
				modelId,
				questionCount: 5,
				difficulty: GENERATE_EXAM_DIFFICULTY.MEDIUM,
			}),
		});

		const response = await createGenerateExamJobHandler(
			{
				kind: "generate-exam",
				title: "Prova",
				questionCount: 5,
				difficulty: "medium",
			},
			new Headers(),
		);

		expect(response.status).toBe(409);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe("active_job_conflict");
	});
});
