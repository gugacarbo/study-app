import { count, desc, eq, type SQL } from "drizzle-orm";
import * as schema from "../schema";
import type { DBQueries } from "./base";
import { buildPaginationMeta, normalizePagination, withWhere } from "./helpers";
import type {
	LLMLogDetail,
	LLMLogInsert,
	LLMLogStatus,
	LLMLogSummary,
	ListLLMLogsFilters,
	PaginatedResult,
} from "./types";

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

const llmLogSummarySelect = {
	id: schema.llmLogs.id,
	call_id: schema.llmLogs.call_id,
	call_type: schema.llmLogs.call_type,
	provider: schema.llmLogs.provider,
	model: schema.llmLogs.model,
	base_url: schema.llmLogs.base_url,
	duration_ms: schema.llmLogs.duration_ms,
	chunks: schema.llmLogs.chunks,
	final_chars: schema.llmLogs.final_chars,
	token_meta: schema.llmLogs.token_meta,
	error_message: schema.llmLogs.error_message,
	status: schema.llmLogs.status,
	created_at: schema.llmLogs.created_at,
} as const;

type LLMLogSummaryRow = {
	id: number;
	call_id: string;
	call_type: string;
	provider: string;
	model: string;
	base_url: string | null;
	duration_ms: number | null;
	chunks: number | null;
	final_chars: number | null;
	token_meta: string | null;
	error_message: string | null;
	status: string;
	created_at: string | null;
};

function toLLMLogSummary(row: LLMLogSummaryRow): LLMLogSummary {
	return {
		...row,
		status: row.status as LLMLogStatus,
	};
}

export function listLLMLogsPaged(
	this: DBQueries,
	filters: ListLLMLogsFilters = {},
): Promise<PaginatedResult<LLMLogSummary>> {
	const { page, pageSize, offset } = normalizePagination(filters);
	const conditions: SQL[] = [];

	if (filters.status !== undefined) {
		conditions.push(eq(schema.llmLogs.status, filters.status));
	}
	if (filters.callType !== undefined) {
		conditions.push(eq(schema.llmLogs.call_type, filters.callType));
	}
	if (filters.provider !== undefined) {
		conditions.push(eq(schema.llmLogs.provider, filters.provider));
	}
	if (filters.model !== undefined) {
		conditions.push(eq(schema.llmLogs.model, filters.model));
	}

	const whereClause = withWhere(conditions);
	const totalPromise = this.db
		.select({ count: count() })
		.from(schema.llmLogs)
		.where(whereClause)
		.get();

	const itemsPromise = this.db
		.select(llmLogSummarySelect)
		.from(schema.llmLogs)
		.where(whereClause)
		.orderBy(desc(schema.llmLogs.created_at), desc(schema.llmLogs.id))
		.limit(pageSize)
		.offset(offset)
		.all();

	return Promise.all([totalPromise, itemsPromise]).then(([total, rows]) => ({
		items: rows.map(toLLMLogSummary),
		pagination: buildPaginationMeta(page, pageSize, total?.count ?? 0),
	}));
}

export function getLLMLogById(
	this: DBQueries,
	id: number,
): Promise<LLMLogDetail | null> {
	return this.db
		.select({
			...llmLogSummarySelect,
			system_prompt: schema.llmLogs.system_prompt,
			request_payload: schema.llmLogs.request_payload,
			response_payload: schema.llmLogs.response_payload,
		})
		.from(schema.llmLogs)
		.where(eq(schema.llmLogs.id, id))
		.get()
		.then((row) =>
			row
				? {
						...toLLMLogSummary(row),
						system_prompt: row.system_prompt,
						request_payload: row.request_payload,
						response_payload: row.response_payload,
					}
				: null,
		);
}
