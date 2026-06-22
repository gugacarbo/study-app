import { generateObject, zodSchema } from "ai";
import { extractedQuestionsRootSchema } from "@/features/ai/jobs/ingest/extracted-question";
import {
	buildIngestLlmCallText,
	buildIngestLlmRetryText,
	buildIngestStreamProgressPart,
	buildIngestTextPart,
	serializeIngestDataPart,
	serializeIngestJobEventPart,
} from "@/features/ai/jobs/ingest/ingest-events";
import { getAiModel } from "@/lib/ai-config";
import { JOB_ERROR_CODE } from "@/lib/job-errors";
import type { IngestJobMetadata } from "@/lib/job-kinds";
import { serializeIngestJobMetadata } from "@/lib/job-kinds";
import {
	createLlmLogCallId,
	logLlmCallComplete,
	logLlmCallStart,
} from "@/lib/llm-logging";
import {
	INGEST_SYSTEM_PROMPT,
	MAX_LLM_RETRIES,
	RETRY_BACKOFF_MS,
} from "./constants";
import { failJob } from "./job-lifecycle";
import {
	defaultSleep,
	extractQuestionsFromLlmOutput,
	isTransientLlmError,
	shortErrorMessage,
} from "./llm-helpers";
import {
	isToolCallingUnsupportedError,
	runIngestAgent,
} from "./run-ingest-agent";
import type { BackgroundJobRow, RunIngestContext } from "./types";

export type ExtractQuestionsResult = {
	questions: unknown[];
	extractionMode: "agent" | "fallback";
};

async function persistExtractionMode(
	ctx: RunIngestContext,
	metadata: IngestJobMetadata,
	extractionMode: "agent" | "fallback",
): Promise<void> {
	await ctx.deps.updateJobStatus(ctx.jobId, {
		metadata: serializeIngestJobMetadata({
			...metadata,
			extractionMode,
		} as IngestJobMetadata & { extractionMode: "agent" | "fallback" }),
	});
}

export async function extractQuestionsWithGenerateObject(
	ctx: RunIngestContext,
	job: BackgroundJobRow,
	metadata: IngestJobMetadata,
	fileText: string,
	model: Awaited<ReturnType<typeof getAiModel>>,
	callId: string,
	startedAt: number,
): Promise<unknown[] | null> {
	const generate = ctx.deps.generateObject ?? generateObject;
	const sleep = ctx.deps.sleep ?? defaultSleep;
	const maxAttempts = MAX_LLM_RETRIES + 1;

	for (let attempt = 0; attempt <= MAX_LLM_RETRIES; attempt++) {
		if (attempt > 0) {
			await ctx.deps.appendJobEvent(
				ctx.jobId,
				serializeIngestJobEventPart(
					buildIngestTextPart(
						buildIngestLlmRetryText(attempt + 1, maxAttempts),
					),
				),
			);
		}

		try {
			const result = await generate({
				model,
				schema: zodSchema(extractedQuestionsRootSchema),
				schemaName: "extracted_questions",
				schemaDescription:
					"Lista de questões objetivas extraídas de prova universitária",
				system: INGEST_SYSTEM_PROMPT,
				prompt: fileText,
			});

			const questions = extractQuestionsFromLlmOutput(result.object);
			if (questions.length > 0) {
				await ctx.deps.appendJobEvent(
					ctx.jobId,
					serializeIngestDataPart(
						buildIngestStreamProgressPart(questions.length),
					),
				);
			}

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

export async function extractQuestions(
	ctx: RunIngestContext,
	job: BackgroundJobRow,
	metadata: IngestJobMetadata,
	fileText: string,
): Promise<unknown[] | null> {
	const resolveModel = ctx.deps.getAiModel ?? getAiModel;
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

	await ctx.deps.appendJobEvent(
		ctx.jobId,
		serializeIngestJobEventPart(buildIngestTextPart(buildIngestLlmCallText())),
	);

	const maxAttempts = MAX_LLM_RETRIES + 1;

	for (let attempt = 0; attempt <= MAX_LLM_RETRIES; attempt++) {
		if (attempt > 0) {
			await ctx.deps.appendJobEvent(
				ctx.jobId,
				serializeIngestJobEventPart(
					buildIngestTextPart(
						buildIngestLlmRetryText(attempt + 1, maxAttempts),
					),
				),
			);
		}

		try {
			const agentResult = await runIngestAgent({
				model,
				fileText,
				jobId: ctx.jobId,
				appendJobEvent: ctx.deps.appendJobEvent.bind(ctx.deps),
				isCancelRequested: () => ctx.deps.isCancelRequested(ctx.jobId),
				streamText: ctx.deps.streamText,
			});

			await logLlmCallComplete(callId, {
				status: "success",
				durationMs: Date.now() - startedAt,
			});
			await persistExtractionMode(ctx, metadata, agentResult.extractionMode);

			return agentResult.questions;
		} catch (error) {
			if (isToolCallingUnsupportedError(error)) {
				break;
			}

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

	const fallbackQuestions = await extractQuestionsWithGenerateObject(
		ctx,
		job,
		metadata,
		fileText,
		model,
		callId,
		startedAt,
	);
	if (fallbackQuestions === null) {
		return null;
	}

	await persistExtractionMode(ctx, metadata, "fallback");
	return fallbackQuestions;
}
