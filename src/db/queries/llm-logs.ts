import * as schema from "../schema";
import type { DBQueries } from "./base";
import type { LLMLogInsert } from "./types";

export function insertLLMLog(
	this: DBQueries,
	log: LLMLogInsert,
): Promise<void> {
	return this.db
		.insert(schema.llmLogs)
		.values({
			call_id: log.callId,
			call_type: log.callType,
			provider: log.provider,
			model: log.model,
			base_url: log.baseUrl ?? null,
			system_prompt: log.systemPrompt ?? null,
			request_payload: log.requestPayload ?? null,
			response_payload: log.responsePayload ?? null,
			duration_ms: log.durationMs ?? null,
			chunks: log.chunks ?? null,
			final_chars: log.finalChars ?? null,
			token_meta: log.tokenMeta ?? null,
			error_message: log.errorMessage ?? null,
			status: log.status ?? "pending",
		})
		.onConflictDoUpdate({
			target: schema.llmLogs.call_id,
			set: {
				call_type: log.callType,
				provider: log.provider,
				model: log.model,
				base_url: log.baseUrl ?? null,
				system_prompt: log.systemPrompt ?? null,
				request_payload: log.requestPayload ?? null,
				response_payload: log.responsePayload ?? null,
				duration_ms: log.durationMs ?? null,
				chunks: log.chunks ?? null,
				final_chars: log.finalChars ?? null,
				token_meta: log.tokenMeta ?? null,
				error_message: log.errorMessage ?? null,
				status: log.status ?? "pending",
			},
		})
		.run()
		.then(() => undefined);
}
