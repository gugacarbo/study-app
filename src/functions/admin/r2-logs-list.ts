import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createDb } from "@/db/client";
import { requireDB } from "@/functions/db";
import { requireAdminSession } from "@/lib/rbac";
import { getR2LogsPage, getR2LogById } from "@/db/queries/r2-logs-admin";
import { r2LogsFiltersSchema } from "@/features/admin/schemas/r2-logs-filters";
import { z } from "zod";

const listSchema = z.object({
	page: z.number().int().positive().default(1),
	pageSize: z.number().int().positive().max(100).default(25),
	filters: r2LogsFiltersSchema.optional().default({}),
});

export const listR2Logs = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => listSchema.parse(data))
	.handler(async ({ data }) => {
		const headers = getRequest().headers;
		await requireAdminSession(headers);
		const db = createDb(await requireDB());
		return getR2LogsPage(db, data.page, data.pageSize, data.filters);
	});

const detailSchema = z.object({
	id: z.string(),
});

export const getR2LogDetail = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => detailSchema.parse(data))
	.handler(async ({ data }) => {
		const headers = getRequest().headers;
		await requireAdminSession(headers);
		const db = createDb(await requireDB());
		return getR2LogById(db, data.id);
	});
