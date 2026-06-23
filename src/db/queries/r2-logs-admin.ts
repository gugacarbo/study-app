import { and, asc, count, desc, eq, gte, lte, sql, sum, avg } from "drizzle-orm";
import type { AppDatabase } from "../client";
import * as schema from "../schema";

export type R2LogsStats = {
	total: number;
	success: number;
	error: number;
	totalBytes: number | null;
	avgDurationMs: number | null;
};

export type R2LogsTimePoint = {
	date: string;
	count: number;
	avgDurationMs: number | null;
	errorCount: number;
};

export type R2LogsPage = {
	rows: Array<{
		id: string;
		userId: string;
		bucket: string;
		operation: string;
		objectKey: string;
		bytes: number | null;
		status: string;
		durationMs: number | null;
		errorMessage: string | null;
		createdAt: string | null;
	}>;
	total: number;
	page: number;
	pageSize: number;
};

export type R2LogsListFilters = {
	userId?: string;
	status?: string;
	bucket?: string;
	operation?: string;
	dateFrom?: string;
	dateTo?: string;
};

function buildFilters(filters: R2LogsListFilters) {
	const conditions: ReturnType<typeof and>[] = [];
	if (filters.userId) conditions.push(eq(schema.r2OperationLogs.userId, filters.userId));
	if (filters.status) conditions.push(eq(schema.r2OperationLogs.status, filters.status));
	if (filters.bucket) conditions.push(eq(schema.r2OperationLogs.bucket, filters.bucket));
	if (filters.operation) conditions.push(eq(schema.r2OperationLogs.operation, filters.operation));
	if (filters.dateFrom) conditions.push(gte(schema.r2OperationLogs.createdAt, filters.dateFrom));
	if (filters.dateTo) conditions.push(lte(schema.r2OperationLogs.createdAt, filters.dateTo));
	return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function getR2LogsStats(
	db: AppDatabase,
	filters: R2LogsListFilters,
): Promise<R2LogsStats> {
	const where = buildFilters(filters);
	const rows = await db
		.select({
			total: count(),
			success: count(sql`CASE WHEN ${schema.r2OperationLogs.status} = 'success' THEN 1 END`),
			error: count(sql`CASE WHEN ${schema.r2OperationLogs.status} = 'error' THEN 1 END`),
			totalBytes: sum(schema.r2OperationLogs.bytes),
			avgDurationMs: avg(schema.r2OperationLogs.durationMs),
		})
		.from(schema.r2OperationLogs)
		.where(where);
	const row = rows[0];
	return {
		total: Number(row.total),
		success: Number(row.success),
		error: Number(row.error),
		totalBytes: row.totalBytes != null ? Number(row.totalBytes) : null,
		avgDurationMs: row.avgDurationMs != null ? Number(row.avgDurationMs) : null,
	};
}

export async function getR2LogsTimeSeries(
	db: AppDatabase,
	granularity: "hour" | "day",
	filters: R2LogsListFilters,
): Promise<R2LogsTimePoint[]> {
	const where = buildFilters(filters);
	const dateExpr =
		granularity === "hour"
			? sql<string>`strftime('%Y-%m-%d %H:00', ${schema.r2OperationLogs.createdAt})`
			: sql<string>`strftime('%Y-%m-%d', ${schema.r2OperationLogs.createdAt})`;

	const rows = await db
		.select({
			date: dateExpr,
			count: count(),
			avgDurationMs: avg(schema.r2OperationLogs.durationMs),
			errorCount: count(sql`CASE WHEN ${schema.r2OperationLogs.status} = 'error' THEN 1 END`),
		})
		.from(schema.r2OperationLogs)
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

export async function getR2LogsPage(
	db: AppDatabase,
	page: number,
	pageSize: number,
	filters: R2LogsListFilters,
): Promise<R2LogsPage> {
	const where = buildFilters(filters);
	const offset = (page - 1) * pageSize;

	const [countResult] = await db
		.select({ total: count() })
		.from(schema.r2OperationLogs)
		.where(where);
	const total = Number(countResult.total);

	const rows = await db
		.select()
		.from(schema.r2OperationLogs)
		.where(where)
		.orderBy(desc(schema.r2OperationLogs.createdAt))
		.limit(pageSize)
		.offset(offset);

	return {
		rows,
		total,
		page,
		pageSize,
	};
}

export async function getR2LogById(
	db: AppDatabase,
	id: string,
) {
	const rows = await db
		.select()
		.from(schema.r2OperationLogs)
		.where(eq(schema.r2OperationLogs.id, id))
		.limit(1);
	return rows[0] ?? null;
}
