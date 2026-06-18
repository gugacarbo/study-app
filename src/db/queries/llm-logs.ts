import { eq } from "drizzle-orm";
import type { AppDatabase } from "../client";
import { createId } from "./helpers";
import * as schema from "../schema";

export type LlmLogStatus = "pending" | "success" | "error";

export type LlmLogInsert = {
	callId: string;
	userId: string;
	callType: string;
	provider: string;
	model: string;
	baseUrl?: string | null;
	systemPrompt?: string | null;
	requestPayload?: string | null;
	responsePayload?: string | null;
	durationMs?: number | null;
	chunks?: number | null;
	finalChars?: number | null;
	tokenMeta?: string | null;
	errorMessage?: string | null;
	status?: LlmLogStatus;
};

export async function insertLlmLog(db: AppDatabase, log: LlmLogInsert) {
	await db
		.insert(schema.llmLogs)
		.values({
			id: createId(),
			userId: log.userId,
			callId: log.callId,
			callType: log.callType,
			provider: log.provider,
			model: log.model,
			baseUrl: log.baseUrl ?? null,
			systemPrompt: log.systemPrompt ?? null,
			requestPayload: log.requestPayload ?? null,
			responsePayload: log.responsePayload ?? null,
			durationMs: log.durationMs ?? null,
			chunks: log.chunks ?? null,
			finalChars: log.finalChars ?? null,
			tokenMeta: log.tokenMeta ?? null,
			errorMessage: log.errorMessage ?? null,
			status: log.status ?? "pending",
		})
		.onConflictDoUpdate({
			target: schema.llmLogs.callId,
			set: {
				status: log.status ?? "pending",
				responsePayload: log.responsePayload ?? null,
				durationMs: log.durationMs ?? null,
				errorMessage: log.errorMessage ?? null,
				finalChars: log.finalChars ?? null,
				tokenMeta: log.tokenMeta ?? null,
			},
		});
}

export async function completeLlmLog(
	db: AppDatabase,
	callId: string,
	update: {
		status: "success" | "error";
		responsePayload?: string | null;
		durationMs?: number | null;
		errorMessage?: string | null;
	},
) {
	await db
		.update(schema.llmLogs)
		.set({
			status: update.status,
			responsePayload: update.responsePayload ?? null,
			durationMs: update.durationMs ?? null,
			errorMessage: update.errorMessage ?? null,
		})
		.where(eq(schema.llmLogs.callId, callId));
}
