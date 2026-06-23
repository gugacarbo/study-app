import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createDb } from "@/db/client";
import { requireDB } from "@/functions/db";
import { requireAdminSession } from "@/lib/rbac";
import { getR2LogsStats as getStats } from "@/db/queries/r2-logs-admin";
import { r2LogsFiltersSchema } from "@/features/admin/schemas/r2-logs-filters";
import { z } from "zod";

const inputSchema = z.object({
	filters: r2LogsFiltersSchema.optional().default({}),
});

export const getR2LogsStats = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => inputSchema.parse(data))
	.handler(async ({ data }) => {
		const headers = getRequest().headers;
		await requireAdminSession(headers);
		const db = createDb(await requireDB());
		return getStats(db, data.filters);
	});
