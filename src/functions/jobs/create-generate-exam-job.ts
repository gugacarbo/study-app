import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "@/db/client";
import { createExam } from "@/db/queries/exams";
import { createId } from "@/db/queries/helpers";
import { createJob } from "@/db/queries/jobs";
import * as schema from "@/db/schema";
import { requireDB } from "@/functions/db";
import { resolveAiModelId } from "@/lib/ai-config";
import { JOB_ERROR_CODE, jobErrorResponse } from "@/lib/job-errors";
import {
	GENERATE_EXAM_DIFFICULTY,
	type GenerateExamJobMetadata,
	JOB_KIND,
	JOB_STATUS,
	serializeGenerateExamJobMetadata,
} from "@/lib/job-kinds";
import { requireSession } from "@/lib/rbac";

export const GENERATED_EXAM_SOURCE = "Gerada por IA";

const ACTIVE_GENERATE_EXAM_STATUSES = [
	JOB_STATUS.AWAITING_UPLOAD,
	JOB_STATUS.QUEUED,
	JOB_STATUS.RUNNING,
] as const;

export const createGenerateExamJobSchema = z.object({
	kind: z.literal(JOB_KIND.GENERATE_EXAM),
	title: z.string().trim().min(1).max(120),
	questionCount: z.coerce.number().int().min(1).max(20),
	difficulty: z.enum([
		GENERATE_EXAM_DIFFICULTY.EASY,
		GENERATE_EXAM_DIFFICULTY.MEDIUM,
		GENERATE_EXAM_DIFFICULTY.HARD,
	]),
	difficultyNotes: z.string().trim().max(2000).optional(),
});

async function hasActiveGenerateExamJob(
	db: ReturnType<typeof createDb>,
	userId: string,
): Promise<boolean> {
	const rows = await db
		.select({ id: schema.backgroundJobs.id })
		.from(schema.backgroundJobs)
		.where(
			and(
				eq(schema.backgroundJobs.userId, userId),
				eq(schema.backgroundJobs.kind, JOB_KIND.GENERATE_EXAM),
				inArray(schema.backgroundJobs.status, [
					...ACTIVE_GENERATE_EXAM_STATUSES,
				]),
			),
		)
		.limit(1);
	return rows.length > 0;
}

export async function createGenerateExamJobHandler(
	body: unknown,
	headers: Headers,
) {
	const session = await requireSession(headers);
	const parsed = createGenerateExamJobSchema.safeParse(body);
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

	if (await hasActiveGenerateExamJob(db, session.user.id)) {
		return jobErrorResponse(JOB_ERROR_CODE.ACTIVE_JOB_CONFLICT, 409);
	}

	const examId = createId();
	await createExam(db, {
		id: examId,
		userId: session.user.id,
		name: input.title,
		source: GENERATED_EXAM_SOURCE,
	});

	const jobId = createId();
	const metadata: GenerateExamJobMetadata = {
		examId,
		modelId,
		questionCount: input.questionCount,
		difficulty: input.difficulty,
		difficultyNotes: input.difficultyNotes,
	};

	await createJob(db, {
		id: jobId,
		userId: session.user.id,
		kind: JOB_KIND.GENERATE_EXAM,
		status: JOB_STATUS.AWAITING_UPLOAD,
		metadata: serializeGenerateExamJobMetadata(metadata),
	});

	return Response.json({ jobId, examId });
}
