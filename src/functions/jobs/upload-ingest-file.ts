import { createDb } from "@/db/client";
import {
	getExamById,
	updateExamSource,
} from "@/db/queries/exams";
import { insertFile } from "@/db/queries/files";
import { buildFileR2Key, createId } from "@/db/queries/helpers";
import { getJobById, updateJobStatus } from "@/db/queries/jobs";
import { requireDB } from "@/functions/db";
import { enqueueJob } from "@/functions/queue";
import { requireFilesBucket } from "@/functions/storage";
import { validateFileExtension } from "@/lib/file-validation";
import {
	JOB_KIND,
	JOB_STATUS,
	parseIngestJobMetadata,
	serializeIngestJobMetadata,
} from "@/lib/job-kinds";
import {
	JOB_ERROR_CODE,
	fileTooLargeResponse,
	jobErrorResponse,
} from "@/lib/job-errors";
import {
	MAX_TEXT_CHARS,
	MAX_UPLOAD_BYTES,
} from "@/lib/ingest-limits";
import { auditedR2Put } from "@/lib/r2-audit";
import { requireSession } from "@/lib/rbac";

const textDecoder = new TextDecoder("utf-8");

export function decodeIngestFileText(bytes: Uint8Array): string {
	return textDecoder.decode(bytes);
}

export function isEmptyIngestText(text: string): boolean {
	return text.trim().length === 0;
}

async function failJobExamNotFound(
	db: ReturnType<typeof createDb>,
	jobId: string,
) {
	await updateJobStatus(db, jobId, {
		status: JOB_STATUS.FAILED,
		error: JOB_ERROR_CODE.EXAM_NOT_FOUND,
	});
}

export async function uploadIngestFileHandler(
	jobId: string,
	request: Request,
	headers: Headers,
) {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());

	const job = await getJobById(db, jobId, session.user.id);
	if (!job) {
		return jobErrorResponse(JOB_ERROR_CODE.JOB_NOT_FOUND, 404);
	}
	if (job.kind !== JOB_KIND.INGEST) {
		return jobErrorResponse(JOB_ERROR_CODE.INVALID_JOB_KIND, 400);
	}
	if (job.status !== JOB_STATUS.AWAITING_UPLOAD) {
		return jobErrorResponse(JOB_ERROR_CODE.JOB_NOT_AWAITING_UPLOAD, 400);
	}

	const metadata = parseIngestJobMetadata(job.metadata);
	if (!metadata?.examId) {
		return jobErrorResponse(JOB_ERROR_CODE.JOB_NOT_FOUND, 404);
	}

	const exam = await getExamById(db, metadata.examId, session.user.id);
	if (!exam) {
		await failJobExamNotFound(db, jobId);
		return jobErrorResponse(JOB_ERROR_CODE.EXAM_NOT_FOUND, 400);
	}

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return jobErrorResponse(JOB_ERROR_CODE.EMPTY_FILE, 400);
	}

	const fileField = formData.get("file");
	if (!(fileField instanceof File)) {
		return jobErrorResponse(JOB_ERROR_CODE.EMPTY_FILE, 400);
	}

	const extensionCheck = validateFileExtension(fileField.name);
	if (!extensionCheck.ok) {
		return jobErrorResponse(JOB_ERROR_CODE.INVALID_FILE_TYPE, 400);
	}

	if (fileField.size > MAX_UPLOAD_BYTES) {
		return fileTooLargeResponse();
	}

	const bytes = new Uint8Array(await fileField.arrayBuffer());
	if (bytes.byteLength > MAX_UPLOAD_BYTES) {
		return fileTooLargeResponse();
	}

	const text = decodeIngestFileText(bytes);
	if (isEmptyIngestText(text)) {
		return jobErrorResponse(JOB_ERROR_CODE.EMPTY_FILE, 400);
	}
	if (text.length > MAX_TEXT_CHARS) {
		return jobErrorResponse(JOB_ERROR_CODE.FILE_TOO_LARGE, 413, {
			maxChars: MAX_TEXT_CHARS,
		});
	}

	const fileId = createId();
	const r2Key = buildFileR2Key(session.user.id, fileId, fileField.name);
	const bucket = await requireFilesBucket();
	const mimeType = fileField.type || "text/plain; charset=utf-8";

	await auditedR2Put(
		bucket,
		{
			userId: session.user.id,
			bucketName: "FILES_BUCKET",
		},
		r2Key,
		bytes,
		{
			httpMetadata: {
				contentType: mimeType,
			},
		},
	);

	try {
		await insertFile(db, {
			id: fileId,
			examId: metadata.examId,
			name: fileField.name,
			r2Key,
			mimeType,
			size: bytes.byteLength,
			ttlSeconds: 0,
		});
	} catch (error) {
		try {
			const { auditedR2Delete } = await import("@/lib/r2-audit");
			await auditedR2Delete(
				bucket,
				{ userId: session.user.id, bucketName: "FILES_BUCKET" },
				r2Key,
			);
		} catch {
			// best-effort compensation
		}
		throw error;
	}

	const sourceUpdated = await updateExamSource(
		db,
		metadata.examId,
		session.user.id,
		fileField.name,
	);
	if (!sourceUpdated) {
		await failJobExamNotFound(db, jobId);
		return jobErrorResponse(JOB_ERROR_CODE.EXAM_NOT_FOUND, 400);
	}

	const nextMetadata = serializeIngestJobMetadata({
		...metadata,
		fileId,
		fileName: fileField.name,
	});

	await updateJobStatus(db, jobId, {
		status: JOB_STATUS.QUEUED,
		metadata: nextMetadata,
	});

	await enqueueJob(jobId);

	return Response.json({ ok: true, fileId });
}
