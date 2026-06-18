import { createDb } from "@/db/client";
import {
	completeLlmLog,
	insertLlmLog,
	type LlmLogInsert,
} from "@/db/queries/llm-logs";
import { requireDB } from "@/functions/db";
import { env } from "@/env";

const MAX_PAYLOAD_CHARS = 8192;

export function shouldLogLlmContent(): boolean {
	return env.AI_LOG_LLM_CONTENT === "true";
}

export function createLlmLogCallId(callType: string): string {
	return `${callType}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

function truncatePayload(value: string | undefined | null): string | null {
	if (!value) return null;
	if (!shouldLogLlmContent()) return "[redacted]";
	return value.length > MAX_PAYLOAD_CHARS
		? `${value.slice(0, MAX_PAYLOAD_CHARS)}…`
		: value;
}

export async function logLlmCallStart(input: LlmLogInsert) {
	const d1 = await requireDB();
	const db = createDb(d1);
	await insertLlmLog(db, {
		...input,
		systemPrompt: truncatePayload(input.systemPrompt),
		requestPayload: truncatePayload(input.requestPayload),
		responsePayload: truncatePayload(input.responsePayload),
		status: input.status ?? "pending",
	});
}

export async function logLlmCallComplete(
	callId: string,
	update: {
		status: "success" | "error";
		responsePayload?: string | null;
		durationMs?: number | null;
		errorMessage?: string | null;
	},
) {
	const d1 = await requireDB();
	const db = createDb(d1);
	await completeLlmLog(db, callId, {
		...update,
		responsePayload: truncatePayload(update.responsePayload),
	});
}
