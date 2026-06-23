import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createDb } from "@/db/client";
import { requireDB } from "@/functions/db";
import { requireAdminSession } from "@/lib/rbac";
import { getLlmLogsTimeSeries as getLlmLogsTimeSeriesQuery } from "@/db/queries/llm-logs-admin";
import { llmLogsFiltersSchema } from "@/features/admin/schemas/llm-logs-filters";
import { z } from "zod";

const inputSchema = z.object({
	granularity: z.enum(["hour", "day"]).default("hour"),
	filters: llmLogsFiltersSchema.optional().default({}),
});

export const getLlmLogsTimeSeries = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => inputSchema.parse(data))
	.handler(async ({ data }) => {
		const headers = getRequest().headers;
		await requireAdminSession(headers);
		const db = createDb(await requireDB());
		return getLlmLogsTimeSeriesQuery(db, data.granularity, data.filters);
	});
