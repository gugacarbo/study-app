import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import { getFileByIdWithOwnership } from "@/db/queries/files";
import { requireDB } from "@/functions/db";
import { requireFilesBucket } from "@/functions/storage";
import { auditedR2Get } from "@/lib/r2-audit";
import { requireSession } from "@/lib/rbac";

const readFileSchema = z.object({
	fileId: z.string().uuid(),
});

function encodeBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i] ?? 0);
	}
	return btoa(binary);
}

export async function readFileHandler(
	input: z.infer<typeof readFileSchema>,
	headers: Headers,
) {
	const session = await requireSession(headers);
	const d1 = await requireDB();
	const db = createDb(d1);
	const file = await getFileByIdWithOwnership(
		db,
		input.fileId,
		session.user.id,
	);
	if (!file) {
		throw new Response("Not Found", { status: 404 });
	}

	const bucket = await requireFilesBucket();
	const object = await auditedR2Get(
		bucket,
		{
			userId: session.user.id,
			bucketName: "FILES_BUCKET",
		},
		file.r2Key,
	);
	if (!object) {
		throw new Response("Not Found", { status: 404 });
	}

	const buffer = await object.arrayBuffer();
	return {
		id: file.id,
		examId: file.examId,
		filename: file.name,
		mimeType: file.mimeType,
		size: file.size ?? buffer.byteLength,
		contentBase64: encodeBase64(new Uint8Array(buffer)),
	};
}

export const readFile = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => readFileSchema.parse(data))
	.handler(async ({ data }) => {
		const request = getRequest();
		return readFileHandler(data, request.headers);
	});

export { readFileSchema };
