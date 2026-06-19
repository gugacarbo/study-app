import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import { getExamById } from "@/db/queries/exams";
import { insertFile } from "@/db/queries/files";
import { buildFileR2Key, createId } from "@/db/queries/helpers";
import { requireDB } from "@/functions/db";
import { requireFilesBucket } from "@/functions/storage";
import {
	ALLOWED_FILE_EXTENSIONS,
	isAllowedFileExtension,
} from "@/lib/file-validation";
import { auditedR2Put } from "@/lib/r2-audit";
import { requireSession } from "@/lib/rbac";

const MAX_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;

const uploadFileSchema = z.object({
	examId: z.string().uuid(),
	filename: z.string().min(1),
	contentBase64: z.string().min(1),
	mimeType: z.string().optional(),
	ttlSeconds: z.number().int().min(0).max(MAX_TTL_SECONDS).optional(),
});

function decodeBase64(contentBase64: string): Uint8Array {
	const binary = atob(contentBase64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

export async function uploadFileHandler(
	input: z.infer<typeof uploadFileSchema>,
	headers: Headers,
) {
	const session = await requireSession(headers);
	if (!isAllowedFileExtension(input.filename)) {
		throw new Response("Only .txt and .md files are allowed", { status: 400 });
	}

	const d1 = await requireDB();
	const db = createDb(d1);
	const exam = await getExamById(db, input.examId, session.user.id);
	if (!exam) {
		throw new Response("Not Found", { status: 404 });
	}

	const fileId = createId();
	const r2Key = buildFileR2Key(session.user.id, fileId, input.filename);
	const bucket = await requireFilesBucket();
	const bytes = decodeBase64(input.contentBase64);

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
				contentType: input.mimeType ?? "text/plain; charset=utf-8",
			},
		},
	);

	try {
		await insertFile(db, {
			id: fileId,
			examId: input.examId,
			name: input.filename,
			r2Key,
			mimeType: input.mimeType ?? null,
			size: bytes.byteLength,
			ttlSeconds: input.ttlSeconds ?? 0,
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

	return { id: fileId, r2Key };
}

export const uploadFile = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => uploadFileSchema.parse(data))
	.handler(async ({ data }) => {
		const request = getRequest();
		return uploadFileHandler(data, request.headers);
	});

export {
	ALLOWED_FILE_EXTENSIONS as ALLOWED_EXTENSIONS,
	MAX_TTL_SECONDS,
	uploadFileSchema,
};
