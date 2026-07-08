import { createDb } from "@/db/client";
import { getExamById } from "@/db/queries/exams";
import { insertFile } from "@/db/queries/files";
import { buildFileR2Key, createId } from "@/db/queries/helpers";
import { getJobById, updateJobStatus } from "@/db/queries/jobs";
import { requireDB } from "@/functions/db";
import { enqueueJob } from "@/functions/queue";
import { requireFilesBucket } from "@/functions/storage";
import { validateFileExtension } from "@/lib/file-validation";
import { MAX_TEXT_CHARS, MAX_UPLOAD_BYTES } from "@/lib/ingest-limits";
import {
	fileTooLargeResponse,
	JOB_ERROR_CODE,
	jobErrorResponse,
} from "@/lib/job-errors";
import {
	type GenerateExamJobMetadata,
	JOB_KIND,
	JOB_STATUS,
	parseGenerateExamJobMetadata,
	serializeGenerateExamJobMetadata,
} from "@/lib/job-kinds";
import { auditedR2Delete, auditedR2Put } from "@/lib/r2-audit";
import { requireSession } from "@/lib/rbac";

const MAIN_CONTENT_FILE_NAME = "conteudo-base.md";
const MAX_CONTEXT_FILES = 5;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8");

function decodeText(bytes: Uint8Array): string {
	return textDecoder.decode(bytes);
}

function isEmptyText(text: string): boolean {
	return text.trim().length === 0;
}

async function readMainContentField(
	value: FormDataEntryValue,
): Promise<string | null> {
	if (typeof value === "string") return value;
	if (value instanceof File) {
		const bytes = new Uint8Array(await value.arrayBuffer());
		return decodeText(bytes);
	}
	return null;
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

export async function uploadGenerateExamContextHandler(
	jobId: string,
	request: Request,
	headers: Headers,
) {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());

	const contentLength = request.headers.get("content-length");
	if (contentLength && Number(contentLength) > MAX_UPLOAD_BYTES) {
		return fileTooLargeResponse();
	}

	const job = await getJobById(db, jobId, session.user.id);
	if (!job) {
		return jobErrorResponse(JOB_ERROR_CODE.JOB_NOT_FOUND, 404);
	}
	if (job.kind !== JOB_KIND.GENERATE_EXAM) {
		return jobErrorResponse(JOB_ERROR_CODE.INVALID_JOB_KIND, 400);
	}
	if (job.status !== JOB_STATUS.AWAITING_UPLOAD) {
		return jobErrorResponse(JOB_ERROR_CODE.JOB_NOT_AWAITING_UPLOAD, 400);
	}

	const metadata = parseGenerateExamJobMetadata(job.metadata);
	if (!metadata?.examId) {
		return jobErrorResponse(JOB_ERROR_CODE.JOB_NOT_FOUND, 404);
	}

	const exam = await getExamById(db, metadata.examId, session.user.id);
	if (!exam) {
		await failJobExamNotFound(db, jobId);
		return jobErrorResponse(JOB_ERROR_CODE.EXAM_NOT_FOUND, 400);
	}
	const examId = metadata.examId;

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return jobErrorResponse(JOB_ERROR_CODE.EMPTY_FILE, 400);
	}

	const mainContentRaw = formData.get("mainContent");
	const mainContent = mainContentRaw
		? await readMainContentField(mainContentRaw)
		: null;
	if (mainContent == null || isEmptyText(mainContent)) {
		return jobErrorResponse(JOB_ERROR_CODE.EMPTY_FILE, 400);
	}

	const contextFileEntries = formData.getAll("contextFiles");
	if (contextFileEntries.length > MAX_CONTEXT_FILES) {
		return jobErrorResponse(JOB_ERROR_CODE.INVALID_FILE_TYPE, 400, {
			message: `Máximo de ${MAX_CONTEXT_FILES} arquivos de contexto permitidos.`,
		});
	}

	const contextFiles: File[] = [];
	for (const entry of contextFileEntries) {
		if (!(entry instanceof File)) {
			return jobErrorResponse(JOB_ERROR_CODE.INVALID_FILE_TYPE, 400);
		}
		if (!validateFileExtension(entry.name).ok) {
			return jobErrorResponse(JOB_ERROR_CODE.INVALID_FILE_TYPE, 400);
		}
		contextFiles.push(entry);
	}

	const contextTexts: string[] = [];
	for (const file of contextFiles) {
		const bytes = new Uint8Array(await file.arrayBuffer());
		const text = decodeText(bytes);
		if (isEmptyText(text)) {
			return jobErrorResponse(JOB_ERROR_CODE.EMPTY_FILE, 400);
		}
		contextTexts.push(text);
	}

	const totalTextChars =
		mainContent.length +
		contextTexts.reduce((sum, text) => sum + text.length, 0);
	if (totalTextChars > MAX_TEXT_CHARS) {
		return jobErrorResponse(JOB_ERROR_CODE.TEXT_TOO_LONG, 413);
	}

	const bucket = await requireFilesBucket();
	const uploadedFileIds: string[] = [];
	const uploadedR2Keys: string[] = [];
	let mainContentFileId: string | null = null;

	async function compensateR2Puts() {
		for (const key of uploadedR2Keys) {
			try {
				await auditedR2Delete(
					bucket,
					{ userId: session.user.id, bucketName: "FILES_BUCKET" },
					key,
				);
			} catch {
				// best-effort compensation
			}
		}
	}

	async function persistR2Text(
		name: string,
		text: string,
	): Promise<{ fileId: string; r2Key: string }> {
		const fileId = createId();
		const r2Key = buildFileR2Key(session.user.id, fileId, name);
		const bytes = textEncoder.encode(text);
		await auditedR2Put(
			bucket,
			{ userId: session.user.id, bucketName: "FILES_BUCKET" },
			r2Key,
			bytes,
			{
				httpMetadata: {
					contentType: "text/plain; charset=utf-8",
				},
			},
		);
		uploadedR2Keys.push(r2Key);
		return { fileId, r2Key };
	}

	async function persistFileRow(
		fileId: string,
		name: string,
		r2Key: string,
		size: number,
	) {
		const ext = name.toLowerCase().split(".").pop();
		const mimeType =
			ext === "md"
				? "text/markdown; charset=utf-8"
				: "text/plain; charset=utf-8";
		await insertFile(db, {
			id: fileId,
			examId,
			name,
			r2Key,
			mimeType,
			size,
			ttlSeconds: 0,
		});
	}

	try {
		const mainContentBytes = textEncoder.encode(mainContent);
		const mainContentPersisted = await persistR2Text(
			MAIN_CONTENT_FILE_NAME,
			mainContent,
		);
		mainContentFileId = mainContentPersisted.fileId;
		await persistFileRow(
			mainContentPersisted.fileId,
			MAIN_CONTENT_FILE_NAME,
			mainContentPersisted.r2Key,
			mainContentBytes.byteLength,
		);

		for (let index = 0; index < contextFiles.length; index++) {
			const file = contextFiles[index];
			const text = contextTexts[index];
			const bytes = textEncoder.encode(text);
			const { fileId, r2Key } = await persistR2Text(file.name, text);
			await persistFileRow(fileId, file.name, r2Key, bytes.byteLength);
			uploadedFileIds.push(fileId);
		}
	} catch (error) {
		await compensateR2Puts();
		await updateJobStatus(db, jobId, {
			status: JOB_STATUS.FAILED,
			error: JOB_ERROR_CODE.UPLOAD_FAILED,
		});
		throw error;
	}

	const nextMetadata: GenerateExamJobMetadata = {
		...metadata,
		fileIds: uploadedFileIds,
	};

	await updateJobStatus(db, jobId, {
		status: JOB_STATUS.QUEUED,
		metadata: serializeGenerateExamJobMetadata(nextMetadata),
	});

	await enqueueJob(jobId);

	return Response.json({
		ok: true,
		mainContentFileId,
		fileIds: uploadedFileIds,
	});
}
