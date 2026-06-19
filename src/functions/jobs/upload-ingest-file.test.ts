import { beforeEach, describe, expect, it, vi } from "vitest";
import { createId } from "@/db/queries/helpers";
import { createJob } from "@/db/queries/jobs";
import {
	resetJobTestDb,
	seedDefaultModel,
	seedExam,
	testDb,
	testUserId,
} from "@/functions/jobs/job-test-setup";
import {
	decodeIngestFileText,
	isEmptyIngestText,
	uploadIngestFileHandler,
} from "@/functions/jobs/upload-ingest-file";
import { MAX_TEXT_CHARS, MAX_UPLOAD_BYTES } from "@/lib/ingest-limits";
import {
	INGEST_MODE,
	JOB_KIND,
	JOB_STATUS,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";

vi.mock("@/functions/queue", () => ({
	enqueueJob: vi.fn(async () => undefined),
}));

vi.mock("@/functions/storage", () => ({
	requireFilesBucket: vi.fn(async () => ({
		put: vi.fn(async () => undefined),
	})),
}));

vi.mock("@/lib/r2-audit", () => ({
	auditedR2Put: vi.fn(async () => undefined),
	auditedR2Delete: vi.fn(async () => undefined),
}));

function makeUploadRequest(file: File) {
	const formData = new FormData();
	formData.set("file", file);
	const request = new Request("http://localhost/api/jobs/job-1/upload", {
		method: "POST",
		body: formData,
	});
	vi.spyOn(request, "formData").mockResolvedValue(formData);
	return request;
}

async function seedAwaitingUploadJob(examId: string, modelId: string) {
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
	return jobId;
}

describe("uploadIngestFileHandler", () => {
	beforeEach(() => {
		resetJobTestDb();
		vi.clearAllMocks();
	});

	it("decodes invalid UTF-8 with replacement characters", () => {
		const text = decodeIngestFileText(
			new Uint8Array([0x68, 0x69, 0xff, 0xfe, 0x21]),
		);
		expect(text).toContain("hi");
		expect(text).toContain("\uFFFD");
	});

	it("treats whitespace-only text as empty", () => {
		expect(isEmptyIngestText("  \n\t  ")).toBe(true);
	});

	it("returns 413 when raw file exceeds upload limit", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const jobId = await seedAwaitingUploadJob(examId, modelId);
		const bytes = new Uint8Array(MAX_UPLOAD_BYTES + 1);
		const file = new File([bytes], "prova.md", { type: "text/markdown" });
		const response = await uploadIngestFileHandler(
			jobId,
			makeUploadRequest(file),
			new Headers(),
		);
		expect(response.status).toBe(413);
		const body = (await response.json()) as {
			error?: string;
			maxBytes?: number;
			maxChars?: number;
		};
		expect(body.error).toBe("file_too_large");
		expect(body.maxBytes).toBe(MAX_UPLOAD_BYTES);
	});

	it("returns 413 when decoded text exceeds character limit", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const jobId = await seedAwaitingUploadJob(examId, modelId);
		const file = new File(["x".repeat(MAX_TEXT_CHARS + 1)], "prova.txt", {
			type: "text/plain",
		});
		const response = await uploadIngestFileHandler(
			jobId,
			makeUploadRequest(file),
			new Headers(),
		);
		expect(response.status).toBe(413);
		const body = (await response.json()) as {
			error?: string;
			maxBytes?: number;
			maxChars?: number;
		};
		expect(body.error).toBe("file_too_large");
		expect(body.maxChars).toBe(MAX_TEXT_CHARS);
	});

	it("returns 400 for empty file", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const jobId = await seedAwaitingUploadJob(examId, modelId);
		const file = new File(["   "], "prova.txt", { type: "text/plain" });
		const response = await uploadIngestFileHandler(
			jobId,
			makeUploadRequest(file),
			new Headers(),
		);
		expect(response.status).toBe(400);
		const body = (await response.json()) as {
			error?: string;
			maxBytes?: number;
			maxChars?: number;
		};
		expect(body.error).toBe("empty_file");
	});

	it("returns 400 for unsupported extension", async () => {
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const jobId = await seedAwaitingUploadJob(examId, modelId);
		const file = new File(["hello"], "prova.pdf", { type: "application/pdf" });
		const response = await uploadIngestFileHandler(
			jobId,
			makeUploadRequest(file),
			new Headers(),
		);
		expect(response.status).toBe(400);
		const body = (await response.json()) as {
			error?: string;
			maxBytes?: number;
			maxChars?: number;
		};
		expect(body.error).toBe("invalid_file_type");
	});

	it("uploads file, updates exam source and name in create mode, queues job", async () => {
		const { enqueueJob } = await import("@/functions/queue");
		const modelId = await seedDefaultModel(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const jobId = await seedAwaitingUploadJob(examId, modelId);
		const file = new File(["Questão 1\nA) sim\nB) não"], "calculo_i-p1.md", {
			type: "text/markdown",
		});

		const response = await uploadIngestFileHandler(
			jobId,
			makeUploadRequest(file),
			new Headers(),
		);
		expect(response.status).toBe(200);
		expect(enqueueJob).toHaveBeenCalledWith(jobId);

		const exams = await testDb
			.select()
			.from((await import("@/db/schema")).exams);
		expect(exams[0]?.source).toBe("calculo_i-p1.md");
		expect(exams[0]?.name).toBe("Calculo i p1");
	});
});
