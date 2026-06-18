import type { R2Bucket } from "@cloudflare/workers-types";
import { streamObject, zodSchema } from "ai";
import type { AppDatabase } from "@/db/client";
import { getExamById } from "@/db/queries/exams";
import { getFileByIdWithOwnership } from "@/db/queries/files";
import {
	extractedQuestionsRootSchema,
} from "@/features/ai/jobs/ingest/extracted-question";
import {
	buildIngestPhasePart,
	buildIngestStreamProgressPart,
	buildIngestSummaryPart,
	buildIngestTextPart,
	serializeIngestDataPart,
	serializeIngestJobEventPart,
} from "@/features/ai/jobs/ingest/ingest-events";
import {
	persistQuestions,
	type PersistQuestionsDeps,
} from "@/features/ai/jobs/ingest/persist-questions";
import { getAiModel } from "@/lib/ai-config";
import { JOB_ERROR_CODE } from "@/lib/job-errors";
import {
	INGEST_PHASE,
	INGEST_WARNING,
	JOB_KIND,
	JOB_STATUS,
	type IngestJobMetadata,
	parseIngestJobMetadata,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";
import {
	createLlmLogCallId,
	logLlmCallComplete,
	logLlmCallStart,
} from "@/lib/llm-logging";
import { auditedR2Get } from "@/lib/r2-audit";

const PHASE_TEXT: Record<(typeof INGEST_PHASE)[keyof typeof INGEST_PHASE], string> = {
	[INGEST_PHASE.READING_FILE]: "Lendo o arquivo enviado…",
	[INGEST_PHASE.EXTRACTING]: "Extraindo questões com o modelo de IA…",
	[INGEST_PHASE.PERSISTING]: "Salvando questões no banco de dados…",
};
const INGEST_SYSTEM_PROMPT =
	"Extraia questões objetivas de prova universitária em português. " +
	"Preencha topic com uma classificação curta do assunto de cada questão.";

const MAX_LLM_RETRIES = 2;
const RETRY_BACKOFF_MS = [500, 1500] as const;

export type BackgroundJobRow = {
	id: string;
	userId: string;
	kind: string;
	status: string;
	phase: string | null;
	error: string | null;
	metadata: string | null;
	cancelRequestedAt: string | null;
};

export type RunIngestDeps = {
	getJobById: (jobId: string) => Promise<BackgroundJobRow | null>;
	updateJobStatus: (
		jobId: string,
		update: {
			status?: string;
			phase?: string | null;
			error?: string | null;
			metadata?: string;
		},
	) => Promise<void>;
	appendJobEvent: (jobId: string, payload: string) => Promise<void>;
	isCancelRequested: (jobId: string) => Promise<boolean>;
	persistQuestionsDeps: PersistQuestionsDeps;
	getAiModel?: typeof getAiModel;
	streamObject?: typeof streamObject;
	sleep?: (ms: number) => Promise<void>;
};

export type RunIngestContext = {
	jobId: string;
	db: AppDatabase;
	filesBucket: R2Bucket;
	deps: RunIngestDeps;
};

export async function runIngest(ctx: RunIngestContext): Promise<void> {
	const job = await ctx.deps.getJobById(ctx.jobId);
	if (!job || job.kind !== JOB_KIND.INGEST) {
		return;
	}
	if (job.status !== JOB_STATUS.QUEUED) {
		return;
	}

	const metadata = parseIngestJobMetadata(job.metadata);
	if (!metadata?.examId || !metadata.modelId || !metadata.fileId) {
		await failJob(ctx, job, JOB_ERROR_CODE.EXAM_NOT_FOUND, metadata);
		return;
	}

	if (await ctx.deps.isCancelRequested(ctx.jobId)) {
		await cancelJob(ctx);
		return;
	}

	await ctx.deps.updateJobStatus(ctx.jobId, {
		status: JOB_STATUS.RUNNING,
		phase: INGEST_PHASE.READING_FILE,
	});
	await emitPhase(ctx, INGEST_PHASE.READING_FILE);

	const exam = await getExamById(ctx.db, metadata.examId, job.userId);
	if (!exam) {
		await failJob(ctx, job, JOB_ERROR_CODE.EXAM_NOT_FOUND, metadata);
		return;
	}

	if (await ctx.deps.isCancelRequested(ctx.jobId)) {
		await cancelJob(ctx);
		return;
	}

	const fileText = await readIngestFileText(ctx, metadata, job.userId);
	if (fileText === null) {
		return;
	}

	await ctx.deps.updateJobStatus(ctx.jobId, {
		phase: INGEST_PHASE.EXTRACTING,
	});
	await emitPhase(ctx, INGEST_PHASE.EXTRACTING);

	if (await ctx.deps.isCancelRequested(ctx.jobId)) {
		await cancelJob(ctx);
		return;
	}

	const extractedQuestions = await extractQuestions(ctx, job, metadata, fileText);
	if (extractedQuestions === null) {
		return;
	}

	if (await ctx.deps.isCancelRequested(ctx.jobId)) {
		await cancelJob(ctx);
		return;
	}

	await ctx.deps.updateJobStatus(ctx.jobId, {
		phase: INGEST_PHASE.PERSISTING,
	});
	await emitPhase(ctx, INGEST_PHASE.PERSISTING);

	const persistResult = await persistQuestions({
		db: ctx.db,
		examId: metadata.examId,
		questions: extractedQuestions,
		deps: {
			...ctx.deps.persistQuestionsDeps,
			onSkippedDuplicate: async (part) => {
				await ctx.deps.appendJobEvent(
					ctx.jobId,
					serializeIngestDataPart(part),
				);
				await ctx.deps.persistQuestionsDeps.onSkippedDuplicate?.(part);
			},
		},
	});

	if (await ctx.deps.isCancelRequested(ctx.jobId)) {
		await cancelJob(ctx);
		return;
	}

	await ctx.deps.appendJobEvent(
		ctx.jobId,
		serializeIngestDataPart(
			buildIngestSummaryPart({
				extracted: persistResult.extractedCount,
				persisted: persistResult.persistedCount,
				skippedDuplicate: persistResult.skippedDuplicateCount,
				invalid: persistResult.invalidCount,
			}),
		),
	);

	const finalMetadata: IngestJobMetadata = {
		...metadata,
		extractedCount: persistResult.extractedCount,
		persistedCount: persistResult.persistedCount,
		skippedDuplicateCount: persistResult.skippedDuplicateCount,
		invalidCount: persistResult.invalidCount,
		...(persistResult.warning ? { warning: persistResult.warning } : {}),
	};

	if (persistResult.persistedCount === 0) {
		await ctx.deps.updateJobStatus(ctx.jobId, {
			status: JOB_STATUS.FAILED,
			phase: INGEST_PHASE.PERSISTING,
			error: JOB_ERROR_CODE.NO_VALID_QUESTIONS,
			metadata: serializeIngestJobMetadata(finalMetadata),
		});
		return;
	}

	await ctx.deps.appendJobEvent(
		ctx.jobId,
		serializeIngestJobEventPart(
			buildIngestTextPart(
				`Importação concluída: ${persistResult.persistedCount} questão(ões) salva(s).`,
			),
		),
	);

	await ctx.deps.updateJobStatus(ctx.jobId, {
		status: JOB_STATUS.COMPLETED,
		phase: INGEST_PHASE.PERSISTING,
		error: null,
		metadata: serializeIngestJobMetadata(finalMetadata),
	});
}

async function readIngestFileText(
	ctx: RunIngestContext,
	metadata: IngestJobMetadata,
	userId: string,
): Promise<string | null> {
	if (!metadata.fileId) {
		await failJob(ctx, { userId } as BackgroundJobRow, JOB_ERROR_CODE.EMPTY_FILE, metadata);
		return null;
	}

	const file = await getFileByIdWithOwnership(ctx.db, metadata.fileId, userId);
	if (!file) {
		await failJob(
			ctx,
			{ userId } as BackgroundJobRow,
			JOB_ERROR_CODE.EXAM_NOT_FOUND,
			metadata,
		);
		return null;
	}

	const object = await auditedR2Get(
		ctx.filesBucket,
		{
			userId,
			bucketName: "FILES_BUCKET",
		},
		file.r2Key,
	);
	if (!object) {
		await failJob(
			ctx,
			{ userId } as BackgroundJobRow,
			"file_not_found",
			metadata,
		);
		return null;
	}

	const buffer = await object.arrayBuffer();
	const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
	if (text.trim().length === 0) {
		await failJob(ctx, { userId } as BackgroundJobRow, JOB_ERROR_CODE.EMPTY_FILE, metadata);
		return null;
	}

	return text;
}

async function extractQuestions(
	ctx: RunIngestContext,
	job: BackgroundJobRow,
	metadata: IngestJobMetadata,
	fileText: string,
): Promise<unknown[] | null> {
	const resolveModel = ctx.deps.getAiModel ?? getAiModel;
	const stream = ctx.deps.streamObject ?? streamObject;
	const sleep = ctx.deps.sleep ?? defaultSleep;

	let model: Awaited<ReturnType<typeof getAiModel>>;
	try {
		model = await resolveModel({
			db: ctx.db,
			userId: job.userId,
			modelId: metadata.modelId,
		});
	} catch {
		await failJob(ctx, job, JOB_ERROR_CODE.MODEL_UNAVAILABLE, metadata);
		return null;
	}

	const callId = createLlmLogCallId("ingest");
	const startedAt = Date.now();
	await logLlmCallStart({
		callId,
		userId: job.userId,
		callType: "ingest",
		provider: "openai-compatible",
		model: metadata.modelId,
	});

	for (let attempt = 0; attempt <= MAX_LLM_RETRIES; attempt++) {
		try {
			const result = stream({
				model,
				schema: zodSchema(extractedQuestionsRootSchema),
				system: INGEST_SYSTEM_PROMPT,
				prompt: fileText,
			});

			let lastQuestionsSeen = 0;
			for await (const partial of result.partialObjectStream) {
				if (await ctx.deps.isCancelRequested(ctx.jobId)) {
					await cancelJob(ctx);
					return null;
				}

				const questionsSeen = partial.questions?.length ?? 0;
				if (questionsSeen > lastQuestionsSeen) {
					lastQuestionsSeen = questionsSeen;
					await ctx.deps.appendJobEvent(
						ctx.jobId,
						serializeIngestDataPart(
							buildIngestStreamProgressPart(questionsSeen),
						),
					);
				}
			}

			const finalObject = await result.object;
			const questions = extractQuestionsFromLlmOutput(finalObject);

			await logLlmCallComplete(callId, {
				status: "success",
				durationMs: Date.now() - startedAt,
			});

			return questions;
		} catch (error) {
			const isLastAttempt = attempt >= MAX_LLM_RETRIES;
			if (!isLastAttempt && isTransientLlmError(error)) {
				await sleep(RETRY_BACKOFF_MS[attempt] ?? RETRY_BACKOFF_MS.at(-1)!);
				continue;
			}

			await logLlmCallComplete(callId, {
				status: "error",
				durationMs: Date.now() - startedAt,
				errorMessage: error instanceof Error ? error.message : "llm_error",
			});
			await failJob(ctx, job, shortErrorMessage(error), metadata);
			return null;
		}
	}

	await failJob(ctx, job, "llm_error", metadata);
	return null;
}

async function failJob(
	ctx: RunIngestContext,
	_job: BackgroundJobRow,
	error: string,
	metadata: IngestJobMetadata | null,
): Promise<void> {
	const base = metadata ?? {
		examId: "",
		modelId: "",
		mode: "create" as const,
	};
	await ctx.deps.updateJobStatus(ctx.jobId, {
		status: JOB_STATUS.FAILED,
		error,
		metadata: serializeIngestJobMetadata(base),
	});
}

async function cancelJob(ctx: RunIngestContext): Promise<void> {
	await ctx.deps.updateJobStatus(ctx.jobId, {
		status: JOB_STATUS.CANCELLED,
		error: null,
	});
}

async function emitPhase(
	ctx: RunIngestContext,
	phase: (typeof INGEST_PHASE)[keyof typeof INGEST_PHASE],
): Promise<void> {
	await ctx.deps.appendJobEvent(
		ctx.jobId,
		serializeIngestDataPart(buildIngestPhasePart(phase)),
	);
	await ctx.deps.appendJobEvent(
		ctx.jobId,
		serializeIngestJobEventPart(buildIngestTextPart(PHASE_TEXT[phase])),
	);
}

function extractQuestionsFromLlmOutput(value: unknown): unknown[] {
	if (!value || typeof value !== "object" || !("questions" in value)) {
		throw new Error("invalid_llm_output");
	}
	const questions = (value as { questions: unknown }).questions;
	if (!Array.isArray(questions)) {
		throw new Error("invalid_llm_output");
	}
	return questions;
}

function isTransientLlmError(error: unknown): boolean {
	if (error && typeof error === "object" && "status" in error) {
		const status = Number((error as { status?: number }).status);
		if (status === 429 || status >= 500) {
			return true;
		}
	}
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			message.includes("timeout") ||
			message.includes("rate limit") ||
			message.includes("429") ||
			message.includes("503") ||
			message.includes("502")
		);
	}
	return false;
}

function shortErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.length > 0) {
		return error.message.slice(0, 200);
	}
	return "llm_error";
}

function defaultSleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export { INGEST_WARNING };
