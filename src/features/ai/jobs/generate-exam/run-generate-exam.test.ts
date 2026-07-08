import { beforeEach, describe, expect, it, vi } from "vitest";
import { JOB_ERROR_CODE } from "@/lib/job-errors";
import {
	GENERATE_EXAM_PHASE,
	JOB_KIND,
	JOB_STATUS,
	serializeGenerateExamJobMetadata,
} from "@/lib/job-kinds";
import {
	type RunGenerateExamContext,
	type RunGenerateExamDeps,
	runGenerateExam,
} from "./run-generate-exam";
import type { GenerateExamRawContext } from "./types";

const userId = "00000000-0000-4000-8000-000000000401";
const jobId = "00000000-0000-4000-8000-000000000501";
const examId = "00000000-0000-4000-8000-000000000201";
const modelId = "00000000-0000-4000-8000-000000000301";

const validMetadata = {
	examId,
	modelId,
	questionCount: 3,
	difficulty: "medium" as const,
};

const validMetadataJson = serializeGenerateExamJobMetadata(validMetadata);

// Use vi.hoisted to create mock objects that are available before vi.mock factories
const mockReadContext = vi.hoisted(() => ({
	buildReadContextDeps: vi.fn(),
	readGenerateExamContextWithDeps: vi.fn(),
}));

const mockParseContextFile = vi.hoisted(() => ({
	parseContextFile: vi.fn(),
}));

const mockStoreParsedArtifact = vi.hoisted(() => ({
	storeParsedArtifact: vi.fn(),
}));

const mockGenerateQuestions = vi.hoisted(() => ({
	generateQuestions: vi.fn(),
}));

const mockPersistQuestions = vi.hoisted(() => ({
	persistQuestions: vi.fn(),
}));

vi.mock("@/features/ai/jobs/generate-exam/read-context", () => mockReadContext);
vi.mock(
	"@/features/ai/jobs/generate-exam/parse-context-file",
	() => mockParseContextFile,
);
vi.mock(
	"@/features/ai/jobs/generate-exam/store-parsed-artifact",
	() => mockStoreParsedArtifact,
);
vi.mock(
	"@/features/ai/jobs/generate-exam/generate-questions",
	() => mockGenerateQuestions,
);
vi.mock(
	"@/features/ai/jobs/ingest/persist-questions",
	() => mockPersistQuestions,
);

function makeJobRow(
	overrides?: Partial<{
		id: string;
		userId: string;
		kind: string;
		status: string;
		metadata: string | null;
		cancelRequestedAt: string | null;
	}>,
) {
	return {
		id: overrides?.id ?? jobId,
		userId: overrides?.userId ?? userId,
		kind: overrides?.kind ?? JOB_KIND.GENERATE_EXAM,
		status: overrides?.status ?? JOB_STATUS.QUEUED,
		metadata: overrides?.metadata ?? validMetadataJson,
		cancelRequestedAt: overrides?.cancelRequestedAt ?? null,
	};
}

function makeRawContext(): GenerateExamRawContext {
	return {
		mainContentFileId: "00000000-0000-4000-8000-000000000601",
		mainContent: "Conteudo base para geracao de questoes.",
		contextFiles: [
			{
				fileId: "00000000-0000-4000-8000-000000000602",
				fileName: "contexto.md",
				text: "Contexto adicional.",
			},
		],
	};
}

function makeValidParsedDocument() {
	return {
		schemaVersion: "1",
		sourceFileId: "file-1",
		title: "Documento de contexto",
		documentType: "notes",
		summary: "Resumo didatico.",
		rawText: "Texto bruto do arquivo.",
		sections: [
			{
				id: "sec-1",
				title: "Secao 1",
				level: 1,
				summary: "Resumo da secao.",
				topicRefs: ["topic-1"],
				keyPoints: ["Ponto chave."],
				sourceSpan: { sectionLabel: "Secao 1", excerpt: "Texto." },
				confidence: "high" as const,
			},
		],
		topics: [
			{
				id: "topic-1",
				name: "Topico 1",
				summary: "Resumo do topico.",
				keywords: ["palavra"],
				sectionRefs: ["sec-1"],
				sourceSpans: [{ sectionLabel: "Secao 1", excerpt: "Texto." }],
				confidence: "high" as const,
			},
		],
		facts: [
			{
				statement: "Fato importante.",
				importance: "high" as const,
				topicRefs: ["topic-1"],
				sourceSpan: { sectionLabel: "Secao 1", excerpt: "Texto." },
				confidence: "high" as const,
			},
		],
		studyObjectives: [
			{
				description: "Objetivo de estudo.",
				topicRefs: ["topic-1"],
				sourceSpan: { sectionLabel: "Secao 1", excerpt: "Texto." },
				confidence: "high" as const,
			},
		],
		glossary: [],
		warnings: [],
	};
}

function makeValidQuestionsResult() {
	return {
		ok: true as const,
		questions: [
			{
				question: "Qual e a capital do Brasil?",
				options: [
					{ key: "A", text: "Brasilia" },
					{ key: "B", text: "Rio de Janeiro" },
					{ key: "C", text: "Sao Paulo" },
					{ key: "D", text: "Salvador" },
				],
				answers: ["A"],
				topic: "Geografia",
			},
			{
				question: "Quem descobriu o Brasil?",
				options: [
					{ key: "A", text: "Pedro Alvares Cabral" },
					{ key: "B", text: "Cristovao Colombo" },
					{ key: "C", text: "Vasco da Gama" },
					{ key: "D", text: "Fernao de Magalhaes" },
				],
				answers: ["A"],
				topic: "Historia",
			},
			{
				question: "Qual e o maior bioma brasileiro?",
				options: [
					{ key: "A", text: "Amazonia" },
					{ key: "B", text: "Cerrado" },
					{ key: "C", text: "Mata Atlantica" },
					{ key: "D", text: "Caatinga" },
				],
				answers: ["A"],
				topic: "Geografia",
			},
		],
		usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
	};
}

function makeDeps(overrides?: {
	getJobById?: () => Promise<unknown>;
	updateJobStatus?: () => Promise<void>;
	appendJobEvent?: () => Promise<void>;
	isCancelRequested?: () => Promise<boolean>;
	heartbeat?: () => Promise<void>;
}): RunGenerateExamDeps {
	const getJobById = overrides?.getJobById ?? vi.fn(async () => makeJobRow());
	const updateJobStatus =
		overrides?.updateJobStatus ?? vi.fn(async () => undefined);
	const appendJobEvent =
		overrides?.appendJobEvent ?? vi.fn(async () => undefined);
	const isCancelRequested =
		overrides?.isCancelRequested ?? vi.fn(async () => false);
	const heartbeat = overrides?.heartbeat ?? vi.fn(async () => undefined);

	return {
		getJobById: getJobById as unknown as RunGenerateExamDeps["getJobById"],
		updateJobStatus:
			updateJobStatus as unknown as RunGenerateExamDeps["updateJobStatus"],
		appendJobEvent:
			appendJobEvent as unknown as RunGenerateExamDeps["appendJobEvent"],
		isCancelRequested:
			isCancelRequested as unknown as RunGenerateExamDeps["isCancelRequested"],
		heartbeat: heartbeat as unknown as RunGenerateExamDeps["heartbeat"],
		persistQuestionsDeps: {
			existsNormalizedQuestion: vi.fn(async () => false),
			batchInsertQuestions: vi.fn(async () => undefined),
		},
	};
}

function makeContext(deps: RunGenerateExamDeps): RunGenerateExamContext {
	return {
		jobId,
		db: {} as never,
		filesBucket: {} as never,
		deps,
	};
}

describe("runGenerateExam", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fails when job not found", async () => {
		const updateJobStatus = vi.fn(async () => undefined);
		const deps = makeDeps({
			getJobById: vi.fn(async () => null),
			updateJobStatus,
		});

		await runGenerateExam(makeContext(deps));

		expect(updateJobStatus).toHaveBeenCalledWith(jobId, {
			status: JOB_STATUS.FAILED,
			error: JOB_ERROR_CODE.JOB_NOT_FOUND,
		});
	});

	it("fails when job kind is not GENERATE_EXAM", async () => {
		const updateJobStatus = vi.fn(async () => undefined);
		const deps = makeDeps({
			getJobById: vi.fn(async () => makeJobRow({ kind: JOB_KIND.INGEST })),
			updateJobStatus,
		});

		await runGenerateExam(makeContext(deps));

		expect(updateJobStatus).toHaveBeenCalledWith(jobId, {
			status: JOB_STATUS.FAILED,
			error: JOB_ERROR_CODE.INVALID_JOB_KIND,
		});
	});

	it("fails when job status is not QUEUED or RUNNING", async () => {
		const updateJobStatus = vi.fn(async () => undefined);
		const deps = makeDeps({
			getJobById: vi.fn(async () =>
				makeJobRow({ status: JOB_STATUS.COMPLETED }),
			),
			updateJobStatus,
		});

		await runGenerateExam(makeContext(deps));

		expect(updateJobStatus).toHaveBeenCalledWith(jobId, {
			status: JOB_STATUS.FAILED,
			error: "invalid_job_status",
		});
	});

	it("fails when metadata is invalid", async () => {
		const updateJobStatus = vi.fn(async () => undefined);
		const deps = makeDeps({
			getJobById: vi.fn(async () => makeJobRow({ metadata: "invalid-json" })),
			updateJobStatus,
		});

		await runGenerateExam(makeContext(deps));

		expect(updateJobStatus).toHaveBeenCalledWith(jobId, {
			status: JOB_STATUS.FAILED,
			error: "invalid_metadata",
		});
	});

	it("fails when readContext returns error", async () => {
		mockReadContext.readGenerateExamContextWithDeps.mockResolvedValue({
			ok: false,
			terminal: { error: JOB_ERROR_CODE.JOB_NOT_FOUND },
		});

		const updateJobStatus = vi.fn(async () => undefined);
		const deps = makeDeps({ updateJobStatus });

		await runGenerateExam(makeContext(deps));

		expect(updateJobStatus).toHaveBeenCalledWith(jobId, {
			status: JOB_STATUS.FAILED,
			error: JOB_ERROR_CODE.JOB_NOT_FOUND,
			metadata: expect.any(String),
		});
	});

	it("fails when parseContextFile returns error for any file", async () => {
		mockReadContext.readGenerateExamContextWithDeps.mockResolvedValue({
			ok: true,
			context: makeRawContext(),
		});
		mockParseContextFile.parseContextFile.mockResolvedValue({
			ok: false,
			terminal: { error: JOB_ERROR_CODE.CONTEXT_PARSE_FAILED },
		});

		const updateJobStatus = vi.fn(async () => undefined);
		const deps = makeDeps({ updateJobStatus });

		await runGenerateExam(makeContext(deps));

		expect(updateJobStatus).toHaveBeenCalledWith(jobId, {
			status: JOB_STATUS.FAILED,
			error: JOB_ERROR_CODE.CONTEXT_PARSE_FAILED,
			metadata: expect.any(String),
		});
	});

	it("fails when storeParsedArtifact returns error", async () => {
		mockReadContext.readGenerateExamContextWithDeps.mockResolvedValue({
			ok: true,
			context: makeRawContext(),
		});
		mockParseContextFile.parseContextFile.mockResolvedValue({
			ok: true,
			document: makeValidParsedDocument(),
		});
		mockStoreParsedArtifact.storeParsedArtifact.mockResolvedValue({
			ok: false,
			error: "r2 failure",
		});

		const updateJobStatus = vi.fn(async () => undefined);
		const deps = makeDeps({ updateJobStatus });

		await runGenerateExam(makeContext(deps));

		expect(updateJobStatus).toHaveBeenCalledWith(jobId, {
			status: JOB_STATUS.FAILED,
			error: JOB_ERROR_CODE.UPLOAD_FAILED,
			metadata: expect.any(String),
		});
	});

	it("fails when generateQuestions fails after all retries", async () => {
		mockReadContext.readGenerateExamContextWithDeps.mockResolvedValue({
			ok: true,
			context: makeRawContext(),
		});
		mockParseContextFile.parseContextFile.mockResolvedValue({
			ok: true,
			document: makeValidParsedDocument(),
		});
		mockStoreParsedArtifact.storeParsedArtifact.mockResolvedValue({
			ok: true,
			artifactFileId: "artifact-1",
			r2Key: "r2-key",
		});
		mockGenerateQuestions.generateQuestions.mockResolvedValue({
			ok: false,
			terminal: { error: JOB_ERROR_CODE.NO_VALID_QUESTIONS },
		});

		const updateJobStatus = vi.fn(async () => undefined);
		const deps = makeDeps({ updateJobStatus });

		await runGenerateExam(makeContext(deps));

		expect(updateJobStatus).toHaveBeenCalledWith(jobId, {
			status: JOB_STATUS.FAILED,
			error: JOB_ERROR_CODE.NO_VALID_QUESTIONS,
			metadata: expect.any(String),
		});
	});

	it("fails when persisted count < questionCount (NO_VALID_QUESTIONS)", async () => {
		mockReadContext.readGenerateExamContextWithDeps.mockResolvedValue({
			ok: true,
			context: makeRawContext(),
		});
		mockParseContextFile.parseContextFile.mockResolvedValue({
			ok: true,
			document: makeValidParsedDocument(),
		});
		mockStoreParsedArtifact.storeParsedArtifact.mockResolvedValue({
			ok: true,
			artifactFileId: "artifact-1",
			r2Key: "r2-key",
		});
		mockGenerateQuestions.generateQuestions.mockResolvedValue(
			makeValidQuestionsResult(),
		);
		mockPersistQuestions.persistQuestions.mockResolvedValue({
			persistedCount: 1,
			skippedDuplicateCount: 0,
			invalidCount: 0,
		});

		const updateJobStatus = vi.fn(async () => undefined);
		const deps = makeDeps({ updateJobStatus });

		await runGenerateExam(makeContext(deps));

		expect(updateJobStatus).toHaveBeenCalledWith(jobId, {
			status: JOB_STATUS.FAILED,
			error: JOB_ERROR_CODE.NO_VALID_QUESTIONS,
			metadata: expect.any(String),
		});
	});

	it("completes successfully with correct status and metadata", async () => {
		mockReadContext.readGenerateExamContextWithDeps.mockResolvedValue({
			ok: true,
			context: makeRawContext(),
		});
		mockParseContextFile.parseContextFile.mockResolvedValue({
			ok: true,
			document: makeValidParsedDocument(),
		});
		mockStoreParsedArtifact.storeParsedArtifact.mockResolvedValue({
			ok: true,
			artifactFileId: "artifact-1",
			r2Key: "r2-key",
		});
		mockGenerateQuestions.generateQuestions.mockResolvedValue(
			makeValidQuestionsResult(),
		);
		mockPersistQuestions.persistQuestions.mockResolvedValue({
			persistedCount: 3,
			skippedDuplicateCount: 0,
			invalidCount: 0,
		});

		const updateJobStatus = vi.fn(async () => undefined);
		const deps = makeDeps({ updateJobStatus });

		await runGenerateExam(makeContext(deps));

		const completedCall = updateJobStatus.mock.calls.find(
			(call: unknown[]) =>
				(call[1] as Record<string, unknown>)?.status === JOB_STATUS.COMPLETED,
		);
		expect(completedCall).toBeDefined();
		const patch = (completedCall as [string, Record<string, unknown>])[1];
		expect(patch.phase).toBeNull();
		expect(patch.metadata).toContain("persistedCount");
	});

	it("checks isCancelRequested between phases and cancels when requested", async () => {
		const isCancelRequested = vi.fn().mockResolvedValue(true);
		const updateJobStatus = vi.fn(async () => undefined);

		const deps = makeDeps({
			isCancelRequested,
			updateJobStatus,
		});

		await runGenerateExam(makeContext(deps));

		expect(isCancelRequested).toHaveBeenCalled();
		expect(updateJobStatus).toHaveBeenCalledWith(jobId, {
			status: JOB_STATUS.CANCELLED,
		});
	});
});
