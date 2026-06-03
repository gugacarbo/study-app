import { and, type SQL } from "drizzle-orm";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export function normalizePagination(input?: {
	page?: number;
	pageSize?: number;
}) {
	const pageRaw = Number(input?.page ?? 1);
	const pageSizeRaw = Number(input?.pageSize ?? DEFAULT_PAGE_SIZE);
	const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
	const pageSize = Number.isFinite(pageSizeRaw)
		? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSizeRaw)))
		: DEFAULT_PAGE_SIZE;
	return { page, pageSize, offset: (page - 1) * pageSize };
}

interface PaginationMeta {
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

export function buildPaginationMeta(
	page: number,
	pageSize: number,
	totalItems: number,
): PaginationMeta {
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	return {
		page,
		pageSize,
		totalItems,
		totalPages,
		hasNextPage: page < totalPages,
		hasPrevPage: page > 1,
	};
}

export function withWhere(conditions: SQL[]) {
	return conditions.length > 0 ? and(...conditions) : undefined;
}
