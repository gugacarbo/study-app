import type { AppDatabase } from "@/db/client";
import {
	appendJobEvent,
	getJobByIdInternal,
	type JobRow,
	renewJobLease,
	updateJobStatus,
} from "@/db/queries/jobs";
import {
	batchInsertQuestions,
	existsNormalizedQuestion,
} from "@/db/queries/questions";
import {
	type RunIngestDeps,
	runIngest,
} from "@/features/ai/jobs/ingest/run-ingest";
import { runImproveQuestionAgent } from "@/features/ai/jobs/improve-questions/run-improve-question-agent";
import { runImproveQuestionExplanationsAgent } from "@/features/ai/jobs/improve-questions/run-improve-question-explanations-agent";
import { runImproveQuestionsBatch } from "@/features/ai/jobs/improve-questions/run-improve-questions-batch";
import { JobEventAppender } from "@/features/ai/jobs/shared/job-event-appender";
import { JOB_KIND } from "@/lib/job-kinds";
import { parseImproveQuestionsJobMetadata } from "@/lib/job-kinds";
import { getAiModel } from "@/lib/ai-config";
import type { JobConsumerBindings } from "@/workers/job-consumer";

export type RunJobConsumerContext = {
	db: AppDatabase;
	env: JobConsumerBindings;
	job: JobRow;
};

export async function runJobConsumer(
	ctx: RunJobConsumerContext,
): Promise<void> {
	const heartbeat = async () => {
		if (!ctx.job.workerId) return;
		await renewJobLease(ctx.db, ctx.job.id, ctx.job.workerId);
	};

	console.log("[run-job-consumer] running job", {
		jobId: ctx.job.id,
		kind: ctx.job.kind,
	});

	switch (ctx.job.kind) {
		case JOB_KIND.INGEST:
			try {
				await runIngest({
					jobId: ctx.job.id,
					db: ctx.db,
					filesBucket: ctx.env.FILES_BUCKET,
					deps: buildRunIngestDeps(ctx),
				});
			} catch (error) {
				console.error("[run-job-consumer] error running ingest", error);
				await updateJobStatus(ctx.db, ctx.job.id, {
					status: "failed",
					error: error instanceof Error ? error.message : "unknown_error",
				});
			}
			break;
		case JOB_KIND.IMPROVE_QUESTIONS: {
			const metadata = parseImproveQuestionsJobMetadata(ctx.job.metadata);
			if (!metadata) {
				await updateJobStatus(ctx.db, ctx.job.id, {
					status: "failed",
					error: "invalid_improve_questions_metadata",
				});
				return;
			}
			const eventAppender = new JobEventAppender(ctx.job.id, async (jobId, payload) => {
				await appendJobEvent(ctx.db, jobId, payload);
			});

			await runImproveQuestionsBatch({
				jobId: ctx.job.id,
				metadata,
				deps: {
					appendJobEvent: async (jobId, payload) => {
						await heartbeat();
						if (jobId !== ctx.job.id) {
							throw new Error("Unexpected job id for improve-questions appender");
						}
						await eventAppender.append(payload);
					},
					updateJobStatus: async (jobId, patch) => {
						await heartbeat();
						await updateJobStatus(ctx.db, jobId, patch);
					},
					isCancelRequested: async () => {
						await heartbeat();
						const job = await getJobByIdInternal(ctx.db, ctx.job.id);
						return job?.cancelRequestedAt != null;
					},
					executeQuestion: async ({ questionId }) => {
						await heartbeat();
						const model = await getAiModel({
							db: ctx.db,
							userId: ctx.job.userId,
							modelId: metadata.modelId,
						});
						return runImproveQuestionAgent({
							db: ctx.db,
							jobId: ctx.job.id,
							userId: ctx.job.userId,
							examId: metadata.examId,
							questionId,
							model: model as never,
							appendJobEvent: async (jobId, payload) => {
								if (jobId !== ctx.job.id) {
									throw new Error(
										"Unexpected job id for improve question appender",
									);
								}
								await eventAppender.append(payload);
							},
							webSearchApiKey: ctx.env.TAVILY_API_KEY,
						});
					},
					executeExplanations: async ({ questionId }) => {
						await heartbeat();
						const model = await getAiModel({
							db: ctx.db,
							userId: ctx.job.userId,
							modelId: metadata.modelId,
						});
						return runImproveQuestionExplanationsAgent({
							db: ctx.db,
							jobId: ctx.job.id,
							userId: ctx.job.userId,
							examId: metadata.examId,
							questionId,
							model: model as never,
							appendJobEvent: async (jobId, payload) => {
								if (jobId !== ctx.job.id) {
									throw new Error(
										"Unexpected job id for improve explanations appender",
									);
								}
								await eventAppender.append(payload);
							},
							webSearchApiKey: ctx.env.TAVILY_API_KEY,
						});
					},
				},
			});
			break;
		}
		case JOB_KIND.EXPLAIN_QUESTION:
		case JOB_KIND.CONNECTION_TEST:
		case JOB_KIND.MODEL_BENCHMARK:
			console.warn("[run-job-consumer] unimplemented kind", {
				jobId: ctx.job.id,
				kind: ctx.job.kind,
			});
			return;
		default:
			console.warn("[run-job-consumer] unknown kind", {
				jobId: ctx.job.id,
				kind: ctx.job.kind,
			});
	}
}

function buildRunIngestDeps(ctx: RunJobConsumerContext): RunIngestDeps {
	const heartbeat = async () => {
		if (!ctx.job.workerId) return;
		await renewJobLease(ctx.db, ctx.job.id, ctx.job.workerId);
	};

	return {
		getJobById: (jobId: string) => getJobByIdInternal(ctx.db, jobId),
		updateJobStatus: async (jobId, update) => {
			await heartbeat();
			await updateJobStatus(ctx.db, jobId, {
				...update,
				status: update.status as Parameters<
					typeof updateJobStatus
				>[2]["status"],
			});
		},
		appendJobEvent: async (jobId: string, payload: string) => {
			await heartbeat();
			await appendJobEvent(ctx.db, jobId, payload);
		},
		isCancelRequested: async (jobId: string) => {
			await heartbeat();
			const job = await getJobByIdInternal(ctx.db, jobId);
			return job?.cancelRequestedAt != null;
		},
		heartbeat,
		persistQuestionsDeps: {
			existsNormalizedQuestion: (examId: string, normalizedText: string) =>
				existsNormalizedQuestion(ctx.db, examId, normalizedText),
			batchInsertQuestions: async (
				questions: Parameters<typeof batchInsertQuestions>[2],
			) => {
				await heartbeat();
				const [first] = questions;
				if (!first) return;
				await batchInsertQuestions(ctx.db, first.examId, questions);
			},
		},
	};
}
