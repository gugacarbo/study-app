import { getFileByIdWithOwnership } from "@/db/queries/files";
import { JOB_ERROR_CODE } from "@/lib/job-errors";
import type { IngestJobMetadata } from "@/lib/job-kinds";
import { auditedR2Get } from "@/lib/r2-audit";
import { failJob } from "./job-lifecycle";
import type { BackgroundJobRow, RunIngestContext } from "./types";

export async function readIngestFileText(
	ctx: RunIngestContext,
	metadata: IngestJobMetadata,
	userId: string,
): Promise<string | null> {
	if (!metadata.fileId) {
		await failJob(
			ctx,
			{ userId } as BackgroundJobRow,
			JOB_ERROR_CODE.EMPTY_FILE,
			metadata,
		);
		return null;
	}

	const file = await getFileByIdWithOwnership(ctx.db, metadata.fileId, userId);
	if (!file) {
		await failJob(
			ctx,
			{ userId } as BackgroundJobRow,
			JOB_ERROR_CODE.EXAM_NOT_FOUND,
			metadata,
		);
		return null;
	}

	const object = await auditedR2Get(
		ctx.filesBucket,
		{
			userId,
			bucketName: "FILES_BUCKET",
		},
		file.r2Key,
	);
	if (!object) {
		await failJob(
			ctx,
			{ userId } as BackgroundJobRow,
			"file_not_found",
			metadata,
		);
		return null;
	}

	const buffer = await object.arrayBuffer();
	const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
	if (text.trim().length === 0) {
		await failJob(
			ctx,
			{ userId } as BackgroundJobRow,
			JOB_ERROR_CODE.EMPTY_FILE,
			metadata,
		);
		return null;
	}

	return text;
}
