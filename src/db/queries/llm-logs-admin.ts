import { and, asc, count, desc, eq, gte, lte, sql, avg } from "drizzle-orm";
import type { AppDatabase } from "../client";
import * as schema from "../schema";

export type LlmLogsStats = {
	total: number;
	success: number;
	error: number;
	pending: number;
	avgDurationMs: number | null;
};

export type LlmLogsTimePoint = {
	date: string;
	count: number;
	avgDurationMs: number | null;
	errorCount: number;
};

export type LlmLogRow = {
	id: string;
	userId: string;
	callId: string;
	callType: string;
	provider: string;
	model: string;
	status: string;
	durationMs: number | null;
	errorMessage: string | null;
	createdAt: string | null;
	tokenMeta: string | null;
	inputCostPerMillion: number | null;
	outputCostPerMillion: number | null;
};

export type LlmLogsPage = {
	rows: LlmLogRow[];
	total: number;
	page: number;
	pageSize: number;
};

export type LlmLogsListFilters = {
	userId?: string;
	status?: string;
	provider?: string;
	model?: string;
	callType?: string;
	dateFrom?: string;
	dateTo?: string;
};

function buildFilters(filters: LlmLogsListFilters) {
	const conditions: ReturnType<typeof and>[] = [];
	if (filters.userId) conditions.push(eq(schema.llmLogs.userId, filters.userId));
	if (filters.status) conditions.push(eq(schema.llmLogs.status, filters.status));
	if (filters.provider) conditions.push(eq(schema.llmLogs.provider, filters.provider));
	if (filters.model) conditions.push(eq(schema.llmLogs.model, filters.model));
	if (filters.callType) conditions.push(eq(schema.llmLogs.callType, filters.callType));
	if (filters.dateFrom) conditions.push(gte(schema.llmLogs.createdAt, filters.dateFrom));
	if (filters.dateTo) conditions.push(lte(schema.llmLogs.createdAt, filters.dateTo));
	return conditions.length > 0 ? and(...conditions) : undefined;
}

function modelCostsCTE(db: AppDatabase) {
	return db.$with("model_costs").as(
		db
			.select({
				modelId: schema.aiModels.modelId,
				inputCostPerMillion: sql<number>`max(${schema.aiModels.inputCostPerMillion})`.as("input_cost_per_million"),
				outputCostPerMillion: sql<number>`max(${schema.aiModels.outputCostPerMillion})`.as("output_cost_per_million"),
			})
			.from(schema.aiModels)
			.groupBy(schema.aiModels.modelId),
	);
}

const LLM_LOG_COLUMNS = {
	id: schema.llmLogs.id,
	userId: schema.llmLogs.userId,
	callId: schema.llmLogs.callId,
	callType: schema.llmLogs.callType,
	provider: schema.llmLogs.provider,
	model: schema.llmLogs.model,
	status: schema.llmLogs.status,
	durationMs: schema.llmLogs.durationMs,
	errorMessage: schema.llmLogs.errorMessage,
	createdAt: schema.llmLogs.createdAt,
	tokenMeta: schema.llmLogs.tokenMeta,
};

export async function getLlmLogsStats(
	db: AppDatabase,
	filters: LlmLogsListFilters,
): Promise<LlmLogsStats> {
	const where = buildFilters(filters);
	const rows = await db
		.select({
			total: count(),
			success: count(sql`CASE WHEN ${schema.llmLogs.status} = 'success' THEN 1 END`),
			error: count(sql`CASE WHEN ${schema.llmLogs.status} = 'error' THEN 1 END`),
			pending: count(sql`CASE WHEN ${schema.llmLogs.status} = 'pending' THEN 1 END`),
			avgDurationMs: avg(schema.llmLogs.durationMs),
		})
		.from(schema.llmLogs)
		.where(where);
	const row = rows[0];
	return {
		total: Number(row.total),
		success: Number(row.success),
		error: Number(row.error),
		pending: Number(row.pending),
		avgDurationMs: row.avgDurationMs != null ? Number(row.avgDurationMs) : null,
	};
}

export async function getLlmLogsTimeSeries(
	db: AppDatabase,
	granularity: "hour" | "day",
	filters: LlmLogsListFilters,
): Promise<LlmLogsTimePoint[]> {
	const where = buildFilters(filters);
	const dateExpr =
		granularity === "hour"
			? sql<string>`strftime('%Y-%m-%d %H:00', ${schema.llmLogs.createdAt})`
			: sql<string>`strftime('%Y-%m-%d', ${schema.llmLogs.createdAt})`;

	const rows = await db
		.select({
			date: dateExpr,
			count: count(),
			avgDurationMs: avg(schema.llmLogs.durationMs),
			errorCount: count(sql`CASE WHEN ${schema.llmLogs.status} = 'error' THEN 1 END`),
		})
		.from(schema.llmLogs)
		.where(where)
		.groupBy(dateExpr)
		.orderBy(asc(dateExpr));

	return rows.map((row) => ({
		date: row.date,
		count: Number(row.count),
		avgDurationMs: row.avgDurationMs != null ? Number(row.avgDurationMs) : null,
		errorCount: Number(row.errorCount),
	}));
}

export async function getLlmLogsPage(
	db: AppDatabase,
	page: number,
	pageSize: number,
	filters: LlmLogsListFilters,
): Promise<LlmLogsPage> {
	const where = buildFilters(filters);
	const offset = (page - 1) * pageSize;
	const modelCosts = modelCostsCTE(db);

	const [countResult] = await db
		.select({ total: count() })
		.from(schema.llmLogs)
		.where(where);
	const total = Number(countResult.total);

	const rows = await db
		.with(modelCosts)
		.select({
			...LLM_LOG_COLUMNS,
			inputCostPerMillion: modelCosts.inputCostPerMillion,
			outputCostPerMillion: modelCosts.outputCostPerMillion,
		})
		.from(schema.llmLogs)
		.leftJoin(modelCosts, eq(schema.llmLogs.model, modelCosts.modelId))
		.where(where)
		.orderBy(desc(schema.llmLogs.createdAt), desc(schema.llmLogs.id))
		.limit(pageSize)
		.offset(offset);

	return {
		rows: rows as LlmLogRow[],
		total,
		page,
		pageSize,
	};
}

export async function getLlmLogById(
	db: AppDatabase,
	id: string,
): Promise<LlmLogRow | null> {
	const modelCosts = modelCostsCTE(db);

	const rows = await db
		.with(modelCosts)
		.select({
			...LLM_LOG_COLUMNS,
			inputCostPerMillion: modelCosts.inputCostPerMillion,
			outputCostPerMillion: modelCosts.outputCostPerMillion,
		})
		.from(schema.llmLogs)
		.leftJoin(modelCosts, eq(schema.llmLogs.model, modelCosts.modelId))
		.where(eq(schema.llmLogs.id, id))
		.limit(1);

	return (rows[0] as LlmLogRow | undefined) ?? null;
}
