import type { R2Bucket } from "@cloudflare/workers-types";
import { createDb } from "@/db/client";
import { deleteFile, listExpiredFiles } from "@/db/queries/files";
import type { AuthBindings } from "@/lib/auth";
import { auditedR2Delete } from "@/lib/r2-audit";

const DEFAULT_BATCH_SIZE = 100;
const SYSTEM_USER_ID = "system";

export type PurgeBindings = Pick<AuthBindings, "DB"> & {
	FILES_BUCKET: R2Bucket;
};

export async function purgeExpiredBlobs(
	env: PurgeBindings,
	batchSize = DEFAULT_BATCH_SIZE,
) {
	const db = createDb(env.DB);
	const expired = await listExpiredFiles(db, batchSize);

	for (const file of expired) {
		try {
			await auditedR2Delete(env.FILES_BUCKET, {
				userId: SYSTEM_USER_ID,
				bucketName: "FILES_BUCKET",
			}, file.r2Key);
		} catch (error) {
			console.warn("[purge] R2 delete failed", file.r2Key, error);
			continue;
		}

		try {
			await deleteFile(db, file.id);
		} catch (error) {
			console.warn("[purge] D1 delete failed", file.id, error);
		}
	}

	return { processed: expired.length };
}
