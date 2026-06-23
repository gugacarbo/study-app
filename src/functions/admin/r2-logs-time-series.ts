import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createDb } from "@/db/client";
import { requireDB } from "@/functions/db";
import { requireAdminSession } from "@/lib/rbac";
import { getR2LogsTimeSeries as getTimeSeries } from "@/db/queries/r2-logs-admin";
import { r2LogsFiltersSchema } from "@/features/admin/schemas/r2-logs-filters";
import { z } from "zod";

const inputSchema = z.object({
	granularity: z.enum(["hour", "day"]).default("day"),
	filters: r2LogsFiltersSchema.optional().default({}),
});

export const getR2LogsTimeSeries = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => inputSchema.parse(data))
	.handler(async ({ data }) => {
		const headers = getRequest().headers;
		await requireAdminSession(headers);
		const db = createDb(await requireDB());
		return getTimeSeries(db, data.granularity, data.filters);
	});
