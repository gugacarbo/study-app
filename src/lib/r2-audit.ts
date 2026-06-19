import type { R2Bucket } from "@cloudflare/workers-types";
import { createDb } from "@/db/client";
import {
	insertR2OperationLog,
	type R2Operation,
} from "@/db/queries/r2-operation-logs";
import { requireDB } from "@/functions/db";

export type AuditedR2Context = {
	userId: string;
	bucketName: string;
};

async function logR2Operation(
	ctx: AuditedR2Context,
	operation: R2Operation,
	objectKey: string,
	startedAt: number,
	result: { status: "success" | "error"; bytes?: number; error?: string },
) {
	try {
		const d1 = await requireDB();
		const db = createDb(d1);
		await insertR2OperationLog(db, {
			userId: ctx.userId,
			bucket: ctx.bucketName,
			operation,
			objectKey,
			bytes: result.bytes ?? null,
			status: result.status,
			durationMs: Date.now() - startedAt,
			errorMessage: result.error ?? null,
		});
	} catch (error) {
		console.error("[r2-audit] failed to persist log", error);
	}
}

export async function auditedR2Put(
	bucket: R2Bucket,
	ctx: AuditedR2Context,
	key: string,
	body: ArrayBuffer | ArrayBufferView | string | Blob | ReadableStream | null,
	options?: R2PutOptions,
) {
	const startedAt = Date.now();
	try {
		await bucket.put(key, body as Parameters<R2Bucket["put"]>[1], options);
		const bytes =
			body instanceof ArrayBuffer
				? body.byteLength
				: typeof body === "string"
					? new TextEncoder().encode(body).byteLength
					: null;
		await logR2Operation(ctx, "put", key, startedAt, {
			status: "success",
			bytes: bytes ?? undefined,
		});
	} catch (error) {
		await logR2Operation(ctx, "put", key, startedAt, {
			status: "error",
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

export async function auditedR2Get(
	bucket: R2Bucket,
	ctx: AuditedR2Context,
	key: string,
	options?: R2GetOptions,
) {
	const startedAt = Date.now();
	try {
		const object = await bucket.get(key, options);
		await logR2Operation(ctx, "get", key, startedAt, {
			status: "success",
			bytes: object?.size,
		});
		return object;
	} catch (error) {
		await logR2Operation(ctx, "get", key, startedAt, {
			status: "error",
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

export async function auditedR2Delete(
	bucket: R2Bucket,
	ctx: AuditedR2Context,
	key: string,
) {
	const startedAt = Date.now();
	try {
		await bucket.delete(key);
		await logR2Operation(ctx, "delete", key, startedAt, { status: "success" });
	} catch (error) {
		await logR2Operation(ctx, "delete", key, startedAt, {
			status: "error",
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

type R2PutOptions = Parameters<R2Bucket["put"]>[2];
type R2GetOptions = Parameters<R2Bucket["get"]>[1];
