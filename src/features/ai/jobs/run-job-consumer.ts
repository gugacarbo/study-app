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
import { runIngest, type RunIngestDeps } from "@/features/ai/jobs/ingest/run-ingest";
import { JOB_KIND } from "@/lib/job-kinds";
import type { JobConsumerBindings } from "@/workers/job-consumer";

export type RunJobConsumerContext = {
	db: AppDatabase;
	env: JobConsumerBindings;
	job: JobRow;
};

export async function runJobConsumer(ctx: RunJobConsumerContext): Promise<void> {
	switch (ctx.job.kind) {
		case JOB_KIND.INGEST:
			await runIngest({
				jobId: ctx.job.id,
				db: ctx.db,
				filesBucket: ctx.env.FILES_BUCKET,
				deps: buildRunIngestDeps(ctx),
			});
			return;
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
				status: update.status as Parameters<typeof updateJobStatus>[2]["status"],
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
				questions: Parameters<
					typeof batchInsertQuestions
				>[2],
			) => {
				const [first] = questions;
				if (!first) return;
				await batchInsertQuestions(ctx.db, first.examId, questions);
			},
		},
	};
}
