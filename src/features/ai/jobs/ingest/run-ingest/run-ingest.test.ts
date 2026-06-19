import { describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "@/db/client";
import * as examsQueries from "@/db/queries/exams";
import * as filesQueries from "@/db/queries/files";
import { INGEST_DATA_PART } from "@/features/ai/jobs/ingest/ingest-events";
import {
	type BackgroundJobRow,
	type RunIngestDeps,
	runIngest,
} from "@/features/ai/jobs/ingest/run-ingest";
import { JOB_ERROR_CODE } from "@/lib/job-errors";
import {
	INGEST_MODE,
	INGEST_PHASE,
	INGEST_WARNING,
	JOB_KIND,
	JOB_STATUS,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";
import * as llmLogging from "@/lib/llm-logging";
import * as r2Audit from "@/lib/r2-audit";

const jobId = "00000000-0000-4000-8000-000000000101";
const examId = "00000000-0000-4000-8000-000000000201";
const fileId = "00000000-0000-4000-8000-000000000301";
const userId = "00000000-0000-4000-8000-000000000401";
const modelId = "00000000-0000-4000-8000-000000000501";

function makeQuestion(index: number) {
	return {
		question: `Questão ${index}?`,
		options: [
			{ key: "A", text: "Opção A" },
			{ key: "B", text: "Opção B" },
		],
		answers: ["A"],
		topic: "Tópico",
	};
}

function makeJob(overrides?: Partial<BackgroundJobRow>): BackgroundJobRow {
	return {
		id: jobId,
		userId,
		kind: JOB_KIND.INGEST,
		status: JOB_STATUS.QUEUED,
		phase: null,
		error: null,
		metadata: serializeIngestJobMetadata({
			examId,
			fileId,
			fileName: "prova.md",
			modelId,
			mode: INGEST_MODE.CREATE,
		}),
		cancelRequestedAt: null,
		...overrides,
	};
}

function createRunDeps(input?: {
	questions?: unknown[];
	getAiModel?: RunIngestDeps["getAiModel"];
	persistQuestionsDeps?: RunIngestDeps["persistQuestionsDeps"];
}): {
	deps: RunIngestDeps;
	updateJobStatus: ReturnType<typeof vi.fn>;
	appendJobEvent: ReturnType<typeof vi.fn>;
} {
	const updateJobStatus = vi.fn(async () => undefined);
	const appendJobEvent = vi.fn(async () => undefined);
	const getJobById = vi.fn(async () => makeJob());
	const isCancelRequested = vi.fn(async () => false);
	const questions = input?.questions ?? [makeQuestion(1)];

	const generateObject = vi.fn(async () => ({
		object: { questions },
	})) as unknown as RunIngestDeps["generateObject"];

	const getAiModel =
		input?.getAiModel ?? vi.fn(async () => ({ modelId: "gpt-4o" }) as never);

	const persistQuestionsDeps = input?.persistQuestionsDeps ?? {
		existsNormalizedQuestion: vi.fn(async () => false),
		batchInsertQuestions: vi.fn(async () => undefined),
	};

	return {
		deps: {
			getJobById,
			updateJobStatus,
			appendJobEvent,
			isCancelRequested,
			getAiModel,
			generateObject,
			sleep: vi.fn(async () => undefined),
			persistQuestionsDeps,
		},
		updateJobStatus,
		appendJobEvent,
	};
}

describe("runIngest", () => {
	it("no-ops when job status is not queued", async () => {
		const updateJobStatus = vi.fn(async () => undefined);
		const deps: RunIngestDeps = {
			getJobById: vi.fn(async () => makeJob({ status: JOB_STATUS.RUNNING })),
			updateJobStatus,
			appendJobEvent: vi.fn(async () => undefined),
			isCancelRequested: vi.fn(async () => false),
			persistQuestionsDeps: {
				existsNormalizedQuestion: vi.fn(async () => false),
				batchInsertQuestions: vi.fn(async () => undefined),
			},
		};

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		expect(updateJobStatus).not.toHaveBeenCalled();
	});

	it("fails with no_valid_questions when LLM returns zero questions", async () => {
		const { deps, updateJobStatus } = createRunDeps({ questions: [] });

		vi.spyOn(examsQueries, "getExamById").mockResolvedValue({
			id: examId,
			userId,
			name: "Prova",
			source: "prova.md",
			createdAt: null,
		});
		vi.spyOn(filesQueries, "getFileByIdWithOwnership").mockResolvedValue({
			id: fileId,
			examId,
			name: "prova.md",
			r2Key: "users/user/files/prova.md",
			mimeType: "text/markdown",
			size: 10,
			ttlSeconds: 0,
			createdAt: null,
		});
		vi.spyOn(r2Audit, "auditedR2Get").mockResolvedValue({
			arrayBuffer: async () => new TextEncoder().encode("conteúdo").buffer,
		} as never);
		vi.spyOn(llmLogging, "logLlmCallStart").mockResolvedValue(undefined);
		vi.spyOn(llmLogging, "logLlmCallComplete").mockResolvedValue(undefined);

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		expect(updateJobStatus).toHaveBeenCalledWith(
			jobId,
			expect.objectContaining({
				status: JOB_STATUS.FAILED,
				error: JOB_ERROR_CODE.NO_VALID_QUESTIONS,
			}),
		);
	});

	it("fails with model_unavailable when getAiModel throws", async () => {
		const { deps, updateJobStatus } = createRunDeps({
			getAiModel: vi.fn(async () => {
				throw new Error("Modelo de IA desabilitado");
			}),
		});

		vi.spyOn(examsQueries, "getExamById").mockResolvedValue({
			id: examId,
			userId,
			name: "Prova",
			source: "prova.md",
			createdAt: null,
		});
		vi.spyOn(filesQueries, "getFileByIdWithOwnership").mockResolvedValue({
			id: fileId,
			examId,
			name: "prova.md",
			r2Key: "users/user/files/prova.md",
			mimeType: "text/markdown",
			size: 10,
			ttlSeconds: 0,
			createdAt: null,
		});
		vi.spyOn(r2Audit, "auditedR2Get").mockResolvedValue({
			arrayBuffer: async () => new TextEncoder().encode("conteúdo").buffer,
		} as never);

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		expect(updateJobStatus).toHaveBeenCalledWith(
			jobId,
			expect.objectContaining({
				status: JOB_STATUS.FAILED,
				error: JOB_ERROR_CODE.MODEL_UNAVAILABLE,
			}),
		);
	});

	it("completes with partial_extraction warning when some questions are invalid", async () => {
		const { deps, updateJobStatus } = createRunDeps({
			questions: [
				makeQuestion(1),
				{
					question: "",
					options: [{ key: "A", text: "A" }],
					answers: ["A"],
					topic: "Inválida",
				},
			],
		});

		vi.spyOn(examsQueries, "getExamById").mockResolvedValue({
			id: examId,
			userId,
			name: "Prova",
			source: "prova.md",
			createdAt: null,
		});
		vi.spyOn(filesQueries, "getFileByIdWithOwnership").mockResolvedValue({
			id: fileId,
			examId,
			name: "prova.md",
			r2Key: "users/user/files/prova.md",
			mimeType: "text/markdown",
			size: 10,
			ttlSeconds: 0,
			createdAt: null,
		});
		vi.spyOn(r2Audit, "auditedR2Get").mockResolvedValue({
			arrayBuffer: async () => new TextEncoder().encode("conteúdo").buffer,
		} as never);
		vi.spyOn(llmLogging, "logLlmCallStart").mockResolvedValue(undefined);
		vi.spyOn(llmLogging, "logLlmCallComplete").mockResolvedValue(undefined);

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		expect(updateJobStatus).toHaveBeenCalledWith(
			jobId,
			expect.objectContaining({
				status: JOB_STATUS.COMPLETED,
				metadata: expect.stringContaining(INGEST_WARNING.PARTIAL_EXTRACTION),
			}),
		);
	});

	it("emits ingest phase and progress events", async () => {
		const { deps, appendJobEvent } = createRunDeps({
			questions: [makeQuestion(1), makeQuestion(2)],
		});

		vi.spyOn(examsQueries, "getExamById").mockResolvedValue({
			id: examId,
			userId,
			name: "Prova",
			source: "prova.md",
			createdAt: null,
		});
		vi.spyOn(filesQueries, "getFileByIdWithOwnership").mockResolvedValue({
			id: fileId,
			examId,
			name: "prova.md",
			r2Key: "users/user/files/prova.md",
			mimeType: "text/markdown",
			size: 10,
			ttlSeconds: 0,
			createdAt: null,
		});
		vi.spyOn(r2Audit, "auditedR2Get").mockResolvedValue({
			arrayBuffer: async () => new TextEncoder().encode("conteúdo").buffer,
		} as never);
		vi.spyOn(llmLogging, "logLlmCallStart").mockResolvedValue(undefined);
		vi.spyOn(llmLogging, "logLlmCallComplete").mockResolvedValue(undefined);

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		const payloads = appendJobEvent.mock.calls.map((call) =>
			JSON.parse(call[1]),
		);
		expect(payloads).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: INGEST_DATA_PART.PHASE,
					data: { phase: INGEST_PHASE.READING_FILE },
				}),
				expect.objectContaining({
					type: INGEST_DATA_PART.PHASE,
					data: { phase: INGEST_PHASE.EXTRACTING },
				}),
				expect.objectContaining({
					type: INGEST_DATA_PART.STREAM_PROGRESS,
				}),
				expect.objectContaining({
					type: INGEST_DATA_PART.SUMMARY,
				}),
			]),
		);
	});

	it("cancels before running when cancel was requested while queued", async () => {
		const { deps, updateJobStatus } = createRunDeps();
		deps.isCancelRequested = vi.fn(async () => true);

		vi.spyOn(examsQueries, "getExamById").mockResolvedValue({
			id: examId,
			userId,
			name: "Prova",
			source: "prova.md",
			createdAt: null,
		});

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		expect(updateJobStatus).toHaveBeenCalledWith(jobId, {
			status: JOB_STATUS.CANCELLED,
			error: null,
		});
		expect(updateJobStatus).not.toHaveBeenCalledWith(
			jobId,
			expect.objectContaining({ status: JOB_STATUS.RUNNING }),
		);
	});

	it("cancels before LLM extraction when cancel is requested", async () => {
		const isCancelRequested = vi.fn(async () => true);

		const generateObject = vi.fn(async () => ({
			object: { questions: [makeQuestion(1)] },
		})) as unknown as RunIngestDeps["generateObject"];

		const updateJobStatus = vi.fn(async () => undefined);
		const appendJobEvent = vi.fn(async () => undefined);
		const deps: RunIngestDeps = {
			getJobById: vi.fn(async () => makeJob()),
			updateJobStatus,
			appendJobEvent,
			isCancelRequested,
			getAiModel: vi.fn(async () => ({ modelId: "gpt-4o" }) as never),
			generateObject,
			sleep: vi.fn(async () => undefined),
			persistQuestionsDeps: {
				existsNormalizedQuestion: vi.fn(async () => false),
				batchInsertQuestions: vi.fn(async () => undefined),
			},
		};

		vi.spyOn(examsQueries, "getExamById").mockResolvedValue({
			id: examId,
			userId,
			name: "Prova",
			source: "prova.md",
			createdAt: null,
		});
		vi.spyOn(filesQueries, "getFileByIdWithOwnership").mockResolvedValue({
			id: fileId,
			examId,
			name: "prova.md",
			r2Key: "users/user/files/prova.md",
			mimeType: "text/markdown",
			size: 10,
			ttlSeconds: 0,
			createdAt: null,
		});
		vi.spyOn(r2Audit, "auditedR2Get").mockResolvedValue({
			arrayBuffer: async () => new TextEncoder().encode("conteúdo").buffer,
		} as never);
		vi.spyOn(llmLogging, "logLlmCallStart").mockResolvedValue(undefined);
		vi.spyOn(llmLogging, "logLlmCallComplete").mockResolvedValue(undefined);

		await runIngest({
			jobId,
			db: {} as AppDatabase,
			filesBucket: {} as never,
			deps,
		});

		expect(generateObject).not.toHaveBeenCalled();
		expect(updateJobStatus).toHaveBeenCalledWith(jobId, {
			status: JOB_STATUS.CANCELLED,
			error: null,
		});
	});
});
