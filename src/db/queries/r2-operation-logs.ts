import type { AppDatabase } from "../client";
import * as schema from "../schema";
import { createId } from "./helpers";

export type R2Operation = "get" | "put" | "delete" | "head" | "list";

export type R2OperationLogInsert = {
	userId: string;
	bucket: string;
	operation: R2Operation;
	objectKey: string;
	bytes?: number | null;
	status: "success" | "error";
	durationMs?: number | null;
	errorMessage?: string | null;
};

export async function insertR2OperationLog(
	db: AppDatabase,
	log: R2OperationLogInsert,
) {
	await db.insert(schema.r2OperationLogs).values({
		id: createId(),
		userId: log.userId,
		bucket: log.bucket,
		operation: log.operation,
		objectKey: log.objectKey,
		bytes: log.bytes ?? null,
		status: log.status,
		durationMs: log.durationMs ?? null,
		errorMessage: log.errorMessage ?? null,
	});
}
