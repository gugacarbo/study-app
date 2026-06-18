import { z } from "zod";
import { createDb } from "@/db/client";
import { createExam, getExamById } from "@/db/queries/exams";
import { createId } from "@/db/queries/helpers";
import { createJob, hasActiveIngestJob } from "@/db/queries/jobs";
import { requireDB } from "@/functions/db";
import { resolveAiModelId } from "@/lib/ai-config";
import {
	INGEST_MODE,
	JOB_KIND,
	JOB_STATUS,
	type IngestJobMetadata,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";
import { JOB_ERROR_CODE, jobErrorResponse } from "@/lib/job-errors";
import { requireSession } from "@/lib/rbac";

const MAX_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;

export const createIngestJobSchema = z
	.object({
		kind: z.literal(JOB_KIND.INGEST),
		name: z.string().trim().min(1).optional(),
		examId: z.string().uuid().optional(),
		modelId: z.string().uuid().optional(),
		ttlSeconds: z.number().int().min(0).max(MAX_TTL_SECONDS).optional(),
	})
	.superRefine((data, ctx) => {
		const hasName = data.name != null;
		const hasExamId = data.examId != null;
		if (!hasName && !hasExamId) {
			ctx.addIssue({
				code: "custom",
				message: "name or examId is required",
				path: ["name"],
			});
		}
		if (hasName && hasExamId) {
			ctx.addIssue({
				code: "custom",
				message: "name and examId are mutually exclusive",
				path: ["name"],
			});
		}
	});

export async function createIngestJobHandler(
	body: unknown,
	headers: Headers,
) {
	const session = await requireSession(headers);
	const parsed = createIngestJobSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json(
			{ error: "validation_error", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	const input = parsed.data;
	const db = createDb(await requireDB());

	let resolvedModelId: string;
	try {
		resolvedModelId = await resolveAiModelId({
			db,
			userId: session.user.id,
			modelId: input.modelId,
		});
	} catch {
		return jobErrorResponse(JOB_ERROR_CODE.MODEL_UNAVAILABLE, 400);
	}

	const jobId = createId();
	let examId: string;
	let mode: IngestJobMetadata["mode"];

	if (input.examId) {
		const exam = await getExamById(db, input.examId, session.user.id);
		if (!exam) {
			return jobErrorResponse(JOB_ERROR_CODE.EXAM_NOT_FOUND, 404);
		}
		if (await hasActiveIngestJob(db, session.user.id, input.examId)) {
			return jobErrorResponse(JOB_ERROR_CODE.ACTIVE_JOB_CONFLICT, 409);
		}
		examId = input.examId;
		mode = INGEST_MODE.APPEND;
	} else {
		examId = createId();
		await createExam(db, {
			id: examId,
			userId: session.user.id,
			name: input.name!,
		});
		mode = INGEST_MODE.CREATE;
	}

	const metadata: IngestJobMetadata = {
		examId,
		modelId: resolvedModelId,
		mode,
	};

	await createJob(db, {
		id: jobId,
		userId: session.user.id,
		kind: JOB_KIND.INGEST,
		status: JOB_STATUS.AWAITING_UPLOAD,
		metadata: serializeIngestJobMetadata(metadata),
	});

	return Response.json({ jobId, examId });
}
