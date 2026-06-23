import { createDb } from "@/db/client";
import {
	completeLlmLog,
	insertLlmLog,
	type CompleteLlmLogUpdate,
	type LlmLogInsert,
} from "@/db/queries/llm-logs";
import { requireDB } from "@/functions/db";

export function createLlmLogCallId(callType: string): string {
	return `${callType}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function logLlmCallStart(input: LlmLogInsert) {
	const d1 = await requireDB();
	const db = createDb(d1);
	await insertLlmLog(db, {
		...input,
		status: input.status ?? "pending",
	});
}

export async function logLlmCallComplete(
	callId: string,
	update: CompleteLlmLogUpdate,
) {
	const d1 = await requireDB();
	const db = createDb(d1);
	await completeLlmLog(db, callId, update);
}
