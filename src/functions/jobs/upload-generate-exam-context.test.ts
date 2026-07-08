import { beforeEach, describe, expect, it, vi } from "vitest";
import { createId } from "@/db/queries/helpers";
import { createJob } from "@/db/queries/jobs";
import * as schema from "@/db/schema";
import {
	resetJobTestDb,
	seedDefaultModel,
	seedExam,
	testDb,
	testUserId,
} from "@/functions/jobs/job-test-setup";
import { uploadGenerateExamContextHandler } from "@/functions/jobs/upload-generate-exam-context";
import { MAX_TEXT_CHARS } from "@/lib/ingest-limits";
import {
	GENERATE_EXAM_DIFFICULTY,
	JOB_KIND,
	JOB_STATUS,
	serializeGenerateExamJobMetadata,
} from "@/lib/job-kinds";

vi.mock("@/functions/queue", () => ({
	enqueueJob: vi.fn(async () => undefined),
}));

vi.mock("@/functions/storage", () => ({
	requireFilesBucket: vi.fn(async () => ({ put: vi.fn(async () => undefined) })),
}));

vi.mock("@/lib/r2-audit", () => ({
	auditedR2Put: vi.fn(async () => undefined),
	auditedR2Delete: vi.fn(async () => undefined),
}));

function makeUploadRequest(formData: FormData) {
	const request = new Request("http://localhost/api/jobs/job-1/upload", {
		method: "POST",
		body: formData,
	});
	vi.spyOn(request, "formData").mockResolvedValue(formData);
	return request;
}

async function seedAwaitingUploadGenerateExamJob(examId: string, modelId: string) {
	const jobId = createId();
	await createJob(testDb, {
		id: jobId,
		userId: testUserId,
		kind: JOB_KIND.GENERATE_EXAM,
		status: JOB_STATUS.AWAITING_UPLOAD,
		metadata: serializeGenerateExamJobMetadata({
			examId,
			modelId,
			questionCount: 3,
			difficulty: GENERATE_EXAM_DIFFICULTY.MEDIUM,
		}),
	});
	return jobId;
}

describe("uploadGenerateExamContextHandler", () => {
	beforeEach(() => {
		resetJobTestDb();
		vi.clearAllMocks();
	});

	it("persists mainContent and context files and queues the job", async () => {
		const { enqueueJob } = await import("@/functions/queue");
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const jobId = await seedAwaitingUploadGenerateExamJob(examId, modelId);

		const formData = new FormData();
		formData.set("mainContent", "Conteúdo base da prova.");
		formData.append("contextFiles", new File(["fato 1"], "contexto.txt", { type: "text/plain" }));
		formData.append("contextFiles", new File(["fato 2"], "contexto.md", { type: "text/markdown" }));

		const response = await uploadGenerateExamContextHandler(
			jobId,
			makeUploadRequest(formData),
			new Headers(),
		);

		expect(response.status).toBe(200);
		expect(enqueueJob).toHaveBeenCalledWith(jobId);

		const files = await testDb.select().from(schema.files);
		expect(files).toHaveLength(3);
		expect(files.map((file) => file.name)).toContain("conteudo-base.md");
		expect(files.every((file) => file.ttlSeconds === 0)).toBe(true);

		const jobs = await testDb.select().from(schema.backgroundJobs);
		expect(jobs[0]?.status).toBe(JOB_STATUS.QUEUED);
	});

	it("returns 400 when mainContent is empty", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const jobId = await seedAwaitingUploadGenerateExamJob(examId, modelId);

		const formData = new FormData();
		formData.set("mainContent", "   ");

		const response = await uploadGenerateExamContextHandler(
			jobId,
			makeUploadRequest(formData),
			new Headers(),
		);

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe("empty_file");
	});

	it("returns 413 when total decoded text is too long", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const jobId = await seedAwaitingUploadGenerateExamJob(examId, modelId);

		const formData = new FormData();
		formData.set("mainContent", "x".repeat(MAX_TEXT_CHARS + 1));

		const response = await uploadGenerateExamContextHandler(
			jobId,
			makeUploadRequest(formData),
			new Headers(),
		);

		expect(response.status).toBe(413);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe("text_too_long");
	});

	it("returns 400 for too many context files", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const jobId = await seedAwaitingUploadGenerateExamJob(examId, modelId);

		const formData = new FormData();
		formData.set("mainContent", "Conteúdo base.");
		for (let i = 0; i < 6; i++) {
			formData.append("contextFiles", new File(["x"], `c${i}.txt`, { type: "text/plain" }));
		}

		const response = await uploadGenerateExamContextHandler(
			jobId,
			makeUploadRequest(formData),
			new Headers(),
		);

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe("invalid_file_type");
	});

	it("returns 400 for unsupported file extension", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const jobId = await seedAwaitingUploadGenerateExamJob(examId, modelId);

		const formData = new FormData();
		formData.set("mainContent", "Conteúdo base.");
		formData.append("contextFiles", new File(["x"], "contexto.pdf", { type: "application/pdf" }));

		const response = await uploadGenerateExamContextHandler(
			jobId,
			makeUploadRequest(formData),
			new Headers(),
		);

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe("invalid_file_type");
	});
});
