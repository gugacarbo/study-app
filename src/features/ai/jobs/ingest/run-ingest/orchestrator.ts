import { getExamById } from "@/db/queries/exams";
import {
	buildIngestPersistProgressPart,
	buildIngestPersistProgressSystemInfo,
	buildIngestPersistValidatingSystemInfo,
	buildIngestSummaryPart,
	buildIngestTextPart,
	serializeIngestDataPart,
	serializeIngestJobEventPart,
} from "@/features/ai/jobs/ingest/ingest-events";
import { persistQuestions } from "@/features/ai/jobs/ingest/persist-questions";
import { JOB_ERROR_CODE } from "@/lib/job-errors";
import {
	INGEST_PHASE,
	type IngestJobMetadata,
	JOB_KIND,
	JOB_STATUS,
	parseIngestJobMetadata,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";
import { extractQuestions } from "./extract-questions";
import { cancelJob, emitPhase, failJob } from "./job-lifecycle";
import { readIngestFileText } from "./read-file";
import type { RunIngestContext } from "./types";

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

	const extractedQuestions = await extractQuestions(
		ctx,
		job,
		metadata,
		fileText,
	);
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
				await ctx.deps.appendJobEvent(ctx.jobId, serializeIngestDataPart(part));
				await ctx.deps.persistQuestionsDeps.onSkippedDuplicate?.(part);
			},
			onPersistProgress: async (saved, total) => {
				if (saved === 0) {
					await ctx.deps.appendJobEvent(
						ctx.jobId,
						serializeIngestDataPart(buildIngestPersistValidatingSystemInfo(total)),
					);
				}
				await ctx.deps.appendJobEvent(
					ctx.jobId,
					serializeIngestDataPart(
						buildIngestPersistProgressPart(saved, total),
					),
				);
				await ctx.deps.appendJobEvent(
					ctx.jobId,
					serializeIngestDataPart(buildIngestPersistProgressSystemInfo(saved, total)),
				);
				await ctx.deps.persistQuestionsDeps.onPersistProgress?.(saved, total);
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
