import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "@/db/client";
import { createId } from "@/db/queries/helpers";
import { createJob } from "@/db/queries/jobs";
import { getPendingQuestionImprovementDraftsByExam } from "@/db/queries/question-improvement-drafts";
import * as schema from "@/db/schema";
import { requireDB } from "@/functions/db";
import { enqueueJob } from "@/functions/queue";
import { resolveAiModelId } from "@/lib/ai-config";
import { JOB_ERROR_CODE, jobErrorResponse } from "@/lib/job-errors";
import {
	IMPROVE_QUESTIONS_DEFAULT_CONCURRENCY,
	JOB_KIND,
	JOB_STATUS,
	serializeImproveQuestionsJobMetadata,
} from "@/lib/job-kinds";
import { requireSession } from "@/lib/rbac";

export const createImproveQuestionsJobSchema = z.object({
	kind: z.literal(JOB_KIND.IMPROVE_QUESTIONS),
	examId: z.string().uuid(),
	questionIds: z.array(z.string().uuid()).min(1),
	concurrencyLimit: z.coerce.number().int().min(1).max(5).optional(),
	writeExplanations: z.boolean().optional(),
	writeOptionExplanations: z.boolean().optional(),
});

export async function createImproveQuestionsJobHandler(
	body: unknown,
	headers: Headers,
) {
	const session = await requireSession(headers);
	const parsed = createImproveQuestionsJobSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json(
			{ error: "validation_error", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	const input = parsed.data;
	const db = createDb(await requireDB());

	let modelId: string;
	try {
		modelId = await resolveAiModelId({ db, userId: session.user.id });
	} catch {
		return jobErrorResponse(JOB_ERROR_CODE.MODEL_UNAVAILABLE, 400);
	}

	const [exam] = await db
		.select({ id: schema.exams.id })
		.from(schema.exams)
		.where(
			and(
				eq(schema.exams.id, input.examId),
				eq(schema.exams.userId, session.user.id),
			),
		)
		.limit(1);
	if (!exam) {
		return jobErrorResponse(JOB_ERROR_CODE.EXAM_NOT_FOUND, 404);
	}

	const questionRows = await db
		.select({ id: schema.questions.id })
		.from(schema.questions)
		.where(
			and(
				eq(schema.questions.examId, input.examId),
				inArray(schema.questions.id, input.questionIds),
			),
		);

	if (questionRows.length !== input.questionIds.length) {
		return jobErrorResponse(JOB_ERROR_CODE.EXAM_NOT_FOUND, 404);
	}

	const activeJobs = await db
		.select()
		.from(schema.backgroundJobs)
		.where(
			and(
				eq(schema.backgroundJobs.userId, session.user.id),
				eq(schema.backgroundJobs.kind, JOB_KIND.IMPROVE_QUESTIONS),
				inArray(schema.backgroundJobs.status, [
					JOB_STATUS.QUEUED,
					JOB_STATUS.RUNNING,
				]),
			),
		);

	for (const job of activeJobs) {
		const metadata = job.metadata ? JSON.parse(job.metadata) : null;
		if (metadata?.examId === input.examId) {
			return jobErrorResponse(JOB_ERROR_CODE.ACTIVE_JOB_CONFLICT, 409, {
				jobId: job.id,
				examId: input.examId,
				reason: "active_job",
			});
		}
	}

	const pendingDrafts = await getPendingQuestionImprovementDraftsByExam(
		db,
		input.examId,
		session.user.id,
	);
	const blockingDraft = pendingDrafts[0];
	if (blockingDraft) {
		return jobErrorResponse(JOB_ERROR_CODE.ACTIVE_JOB_CONFLICT, 409, {
			jobId: blockingDraft.jobId,
			examId: input.examId,
			reason: "pending_review",
			message:
				"Já existe um processo de melhoria pendente de aprovação para esta prova.",
		});
	}

	const jobId = createId();
	await createJob(db, {
		id: jobId,
		userId: session.user.id,
		kind: JOB_KIND.IMPROVE_QUESTIONS,
		status: JOB_STATUS.QUEUED,
		metadata: serializeImproveQuestionsJobMetadata({
			examId: input.examId,
			modelId,
			writeExplanations: input.writeExplanations ?? false,
			writeOptionExplanations: input.writeOptionExplanations ?? false,
			questionIds: input.questionIds,
			concurrencyLimit:
				input.concurrencyLimit ?? IMPROVE_QUESTIONS_DEFAULT_CONCURRENCY,
			totalCount: input.questionIds.length,
			queuedCount: input.questionIds.length,
			runningCount: 0,
			completedCount: 0,
			failedCount: 0,
			cancelledCount: 0,
			pendingReviewCount: 0,
			items: input.questionIds.map((questionId, index) => ({
				questionId,
				questionNumber: index + 1,
				status: "queued" as const,
				stage: "queued" as const,
			})),
		}),
	});

	await enqueueJob(jobId);

	return Response.json({ jobId });
}
