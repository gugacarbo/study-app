import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createDb } from "@/db/client";
import { requireDB } from "@/functions/db";
import { requireAdminSession } from "@/lib/rbac";
import { getLlmLogsPage, getLlmLogById } from "@/db/queries/llm-logs-admin";
import { llmLogsFiltersSchema } from "@/features/admin/schemas/llm-logs-filters";
import { z } from "zod";

const listSchema = z.object({
	page: z.number().int().positive().default(1),
	pageSize: z.number().int().positive().max(100).default(25),
	filters: llmLogsFiltersSchema.optional().default({}),
});

export const listLlmLogs = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => listSchema.parse(data))
	.handler(async ({ data }) => {
		const headers = getRequest().headers;
		await requireAdminSession(headers);
		const db = createDb(await requireDB());
		return getLlmLogsPage(db, data.page, data.pageSize, data.filters);
	});

const detailSchema = z.object({
	id: z.string(),
});

export const getLlmLogDetail = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => detailSchema.parse(data))
	.handler(async ({ data }) => {
		const headers = getRequest().headers;
		await requireAdminSession(headers);
		const db = createDb(await requireDB());
		return getLlmLogById(db, data.id);
	});
