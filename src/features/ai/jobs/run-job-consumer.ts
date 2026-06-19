import type { AppDatabase } from "@/db/client";
import {
	appendJobEvent,
	getJobByIdInternal,
	type JobRow,
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
import { JOB_KIND } from "@/lib/job-kinds";
import type { JobConsumerBindings } from "@/workers/job-consumer";

export type RunJobConsumerContext = {
	db: AppDatabase;
	env: JobConsumerBindings;
	job: JobRow;
};

export async function runJobConsumer(
	ctx: RunJobConsumerContext,
): Promise<void> {
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
	return {
		getJobById: (jobId: string) => getJobByIdInternal(ctx.db, jobId),
		updateJobStatus: (jobId, update) =>
			updateJobStatus(ctx.db, jobId, {
				...update,
				status: update.status as Parameters<
					typeof updateJobStatus
				>[2]["status"],
			}),
		appendJobEvent: async (jobId: string, payload: string) => {
			await appendJobEvent(ctx.db, jobId, payload);
		},
		isCancelRequested: async (jobId: string) => {
			const job = await getJobByIdInternal(ctx.db, jobId);
			return job?.cancelRequestedAt != null;
		},
		persistQuestionsDeps: {
			existsNormalizedQuestion: (examId: string, normalizedText: string) =>
				existsNormalizedQuestion(ctx.db, examId, normalizedText),
			batchInsertQuestions: async (
				questions: Parameters<typeof batchInsertQuestions>[2],
			) => {
				const [first] = questions;
				if (!first) return;
				await batchInsertQuestions(ctx.db, first.examId, questions);
			},
		},
	};
}
