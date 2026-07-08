import type { R2Bucket } from "@cloudflare/workers-types";
import type { AppDatabase } from "@/db/client";
import { buildGenerationContext } from "@/features/ai/jobs/generate-exam/build-generation-context";
import { generateQuestions } from "@/features/ai/jobs/generate-exam/generate-questions";
import { parseContextFile } from "@/features/ai/jobs/generate-exam/parse-context-file";
import {
	buildReadContextDeps,
	readGenerateExamContextWithDeps,
} from "@/features/ai/jobs/generate-exam/read-context";
import { storeParsedArtifact } from "@/features/ai/jobs/generate-exam/store-parsed-artifact";
import { normalizeQuestionText } from "@/features/ai/jobs/ingest/normalize-question";
import {
	persistQuestions,
	type QuestionInsert,
} from "@/features/ai/jobs/ingest/persist-questions";
import { JobEventAppender } from "@/features/ai/jobs/shared/job-event-appender";
import { JOB_ERROR_CODE } from "@/lib/job-errors";
import {
	GENERATE_EXAM_PHASE,
	JOB_KIND,
	JOB_STATUS,
	parseGenerateExamJobMetadata,
	serializeGenerateExamJobMetadata,
} from "@/lib/job-kinds";

export type RunGenerateExamContext = {
	jobId: string;
	db: AppDatabase;
	filesBucket: R2Bucket;
	deps: RunGenerateExamDeps;
};

export type RunGenerateExamDeps = {
	getJobById: (jobId: string) => Promise<JobRowLike | null>;
	updateJobStatus: (
		jobId: string,
		patch: {
			status?: string;
			phase?: string | null;
			error?: string | null;
			metadata?: string | null;
		},
	) => Promise<void>;
	appendJobEvent: (jobId: string, payload: unknown) => Promise<void>;
	isCancelRequested: (jobId: string) => Promise<boolean>;
	heartbeat: () => Promise<void>;
	persistQuestionsDeps: {
		existsNormalizedQuestion: (
			examId: string,
			normalizedText: string,
		) => Promise<boolean>;
		batchInsertQuestions: (questions: QuestionInsert[]) => Promise<void>;
	};
};

type JobRowLike = {
	id: string;
	userId: string;
	kind: string;
	status: string;
	metadata: string | null;
	cancelRequestedAt: string | null;
};

export async function runGenerateExam(
	ctx: RunGenerateExamContext,
): Promise<void> {
	const { jobId, db, filesBucket, deps } = ctx;
	const eventAppender = new JobEventAppender(jobId, async (id, payload) => {
		await deps.heartbeat();
		await deps.appendJobEvent(id, payload);
	});

	const appendText = async (text: string) => {
		await eventAppender.append({ type: "text", text });
	};

	const appendPhase = async (phase: string) => {
		await eventAppender.append({
			type: "data-generate-exam-phase",
			data: { phase },
		});
	};

	// 1. Read job from DB, validate kind and status
	const job = await deps.getJobById(jobId);
	if (!job) {
		await deps.updateJobStatus(jobId, {
			status: JOB_STATUS.FAILED,
			error: JOB_ERROR_CODE.JOB_NOT_FOUND,
		});
		return;
	}

	if (job.kind !== JOB_KIND.GENERATE_EXAM) {
		await deps.updateJobStatus(jobId, {
			status: JOB_STATUS.FAILED,
			error: JOB_ERROR_CODE.INVALID_JOB_KIND,
		});
		return;
	}

	if (job.status !== JOB_STATUS.QUEUED && job.status !== JOB_STATUS.RUNNING) {
		await deps.updateJobStatus(jobId, {
			status: JOB_STATUS.FAILED,
			error: "invalid_job_status",
		});
		return;
	}

	const metadata = parseGenerateExamJobMetadata(job.metadata);
	if (!metadata) {
		await deps.updateJobStatus(jobId, {
			status: JOB_STATUS.FAILED,
			error: "invalid_metadata",
		});
		return;
	}

	const userId = job.userId;

	// 2. Phase: reading_context
	await appendPhase(GENERATE_EXAM_PHASE.READING_CONTEXT);
	await appendText("Lendo conteúdo base e arquivos de contexto…");
	await deps.heartbeat();

	if (await deps.isCancelRequested(jobId)) {
		await deps.updateJobStatus(jobId, { status: JOB_STATUS.CANCELLED });
		return;
	}

	const readDeps = buildReadContextDeps(filesBucket as never, userId);
	const readResult = await readGenerateExamContextWithDeps(
		db,
		metadata,
		userId,
		readDeps,
	);

	if (!readResult.ok) {
		await deps.updateJobStatus(jobId, {
			status: JOB_STATUS.FAILED,
			error: readResult.terminal.error,
			metadata: serializeGenerateExamJobMetadata(metadata),
		});
		return;
	}

	const rawContext = readResult.context;
	metadata.fileIds = [
		rawContext.mainContentFileId,
		...rawContext.contextFiles.map((f) => f.fileId),
	];

	// 3. Phase: parsing_context_files
	await appendPhase(GENERATE_EXAM_PHASE.PARSING_CONTEXT_FILES);
	await appendText("Processando arquivos de contexto com IA…");
	await deps.heartbeat();

	if (await deps.isCancelRequested(jobId)) {
		await deps.updateJobStatus(jobId, { status: JOB_STATUS.CANCELLED });
		return;
	}

	const parsedDocuments: Array<{
		document: import("@/features/ai/jobs/generate-exam/parser-schema").ParsedContextDocument;
		artifactFileId: string;
	}> = [];

	for (const file of rawContext.contextFiles) {
		await deps.heartbeat();

		if (await deps.isCancelRequested(jobId)) {
			await deps.updateJobStatus(jobId, { status: JOB_STATUS.CANCELLED });
			return;
		}

		const parseResult = await parseContextFile(file, metadata, userId, db);
		if (!parseResult.ok) {
			await deps.updateJobStatus(jobId, {
				status: JOB_STATUS.FAILED,
				error: parseResult.terminal.error,
				metadata: serializeGenerateExamJobMetadata(metadata),
			});
			return;
		}

		const storeResult = await storeParsedArtifact(
			filesBucket as never,
			userId,
			parseResult.document,
		);
		if (!storeResult.ok) {
			await deps.updateJobStatus(jobId, {
				status: JOB_STATUS.FAILED,
				error: JOB_ERROR_CODE.UPLOAD_FAILED,
				metadata: serializeGenerateExamJobMetadata(metadata),
			});
			return;
		}

		parsedDocuments.push({
			document: parseResult.document,
			artifactFileId: storeResult.artifactFileId,
		});
	}

	metadata.parsedContextArtifactIds = parsedDocuments.map(
		(p) => p.artifactFileId,
	);
	metadata.parsedContextCount = parsedDocuments.length;

	// 4. Build generation context
	const buildResult = buildGenerationContext(
		rawContext,
		parsedDocuments.map((p) => p.document),
		metadata,
	);
	if (!buildResult.ok) {
		await deps.updateJobStatus(jobId, {
			status: JOB_STATUS.FAILED,
			error: buildResult.error,
			metadata: serializeGenerateExamJobMetadata(metadata),
		});
		return;
	}

	const generationContext = buildResult.context;

	// 5. Phase: generating_questions
	await appendPhase(GENERATE_EXAM_PHASE.GENERATING_QUESTIONS);
	await appendText("Gerando questões objetivas…");
	await deps.heartbeat();

	if (await deps.isCancelRequested(jobId)) {
		await deps.updateJobStatus(jobId, { status: JOB_STATUS.CANCELLED });
		return;
	}

	const MAX_GENERATION_RETRIES = 2;
	let allQuestions: unknown[] = [];
	let totalTokenUsage: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
	} = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
	let totalCost = 0;

	for (let attempt = 0; attempt <= MAX_GENERATION_RETRIES; attempt++) {
		await deps.heartbeat();

		if (await deps.isCancelRequested(jobId)) {
			await deps.updateJobStatus(jobId, { status: JOB_STATUS.CANCELLED });
			return;
		}

		if (attempt > 0) {
			await appendText(
				`Tentativa ${attempt + 1}/${MAX_GENERATION_RETRIES + 1} de geração…`,
			);
		}

		const genResult = await generateQuestions(
			generationContext,
			metadata,
			userId,
			db,
		);

		if (!genResult.ok) {
			if (attempt < MAX_GENERATION_RETRIES) {
				continue;
			}
			await deps.updateJobStatus(jobId, {
				status: JOB_STATUS.FAILED,
				error: genResult.terminal.error,
				metadata: serializeGenerateExamJobMetadata(metadata),
			});
			return;
		}

		if (genResult.usage) {
			totalTokenUsage.inputTokens += genResult.usage.inputTokens;
			totalTokenUsage.outputTokens += genResult.usage.outputTokens;
			totalTokenUsage.totalTokens += genResult.usage.totalTokens;
		}

		// Deduplicate against previously generated questions
		const seenNormalized = new Set(
			allQuestions.map((q) => {
				const raw = q as { question?: string };
				return normalizeQuestionText(raw.question ?? "");
			}),
		);

		for (const q of genResult.questions) {
			const raw = q as { question?: string };
			const normalized = normalizeQuestionText(raw.question ?? "");
			if (!seenNormalized.has(normalized)) {
				seenNormalized.add(normalized);
				allQuestions.push(q);
			}
		}

		// Check if we have enough questions
		if (allQuestions.length >= metadata.questionCount) {
			break;
		}
	}

	if (allQuestions.length < metadata.questionCount) {
		await deps.updateJobStatus(jobId, {
			status: JOB_STATUS.FAILED,
			error: JOB_ERROR_CODE.NO_VALID_QUESTIONS,
			metadata: serializeGenerateExamJobMetadata({
				...metadata,
				extractedCount: allQuestions.length,
				inputTokens: totalTokenUsage.inputTokens,
				outputTokens: totalTokenUsage.outputTokens,
				totalTokens: totalTokenUsage.totalTokens,
				cost: totalCost,
			}),
		});
		return;
	}

	metadata.extractedCount = allQuestions.length;
	metadata.inputTokens = totalTokenUsage.inputTokens;
	metadata.outputTokens = totalTokenUsage.outputTokens;
	metadata.totalTokens = totalTokenUsage.totalTokens;
	metadata.cost = totalCost;

	// 6. Phase: persisting
	await appendPhase(GENERATE_EXAM_PHASE.PERSISTING);
	await appendText("Salvando questões no banco de dados…");
	await deps.heartbeat();

	if (await deps.isCancelRequested(jobId)) {
		await deps.updateJobStatus(jobId, { status: JOB_STATUS.CANCELLED });
		return;
	}

	const persistResult = await persistQuestions({
		db,
		examId: metadata.examId,
		questions: allQuestions,
		deps: {
			existsNormalizedQuestion:
				deps.persistQuestionsDeps.existsNormalizedQuestion,
			batchInsertQuestions: async (questions) => {
				await deps.heartbeat();
				await deps.persistQuestionsDeps.batchInsertQuestions(questions);
			},
		},
	});

	if (persistResult.persistedCount < metadata.questionCount) {
		await deps.updateJobStatus(jobId, {
			status: JOB_STATUS.FAILED,
			error: JOB_ERROR_CODE.NO_VALID_QUESTIONS,
			metadata: serializeGenerateExamJobMetadata({
				...metadata,
				persistedCount: persistResult.persistedCount,
				skippedDuplicateCount: persistResult.skippedDuplicateCount,
				invalidCount: persistResult.invalidCount,
			}),
		});
		return;
	}

	// 7. Success
	metadata.persistedCount = persistResult.persistedCount;
	metadata.skippedDuplicateCount = persistResult.skippedDuplicateCount;
	metadata.invalidCount = persistResult.invalidCount;

	await deps.updateJobStatus(jobId, {
		status: JOB_STATUS.COMPLETED,
		phase: null,
		metadata: serializeGenerateExamJobMetadata(metadata),
	});

	await appendText(
		`Geração concluída: ${persistResult.persistedCount} questões salvas.`,
	);
}
