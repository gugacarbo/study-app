import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createDb } from "@/db/client";
import { requireDB } from "@/functions/db";
import { requireAdminSession } from "@/lib/rbac";
import { getLlmLogsStats as getStats } from "@/db/queries/llm-logs-admin";
import { llmLogsFiltersSchema } from "@/features/admin/schemas/llm-logs-filters";
import { z } from "zod";

const inputSchema = z.object({
	filters: llmLogsFiltersSchema.optional().default({}),
});

export const getLlmLogsStats = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => inputSchema.parse(data))
	.handler(async ({ data }) => {
		const headers = getRequest().headers;
		await requireAdminSession(headers);
		const db = createDb(await requireDB());
		return getStats(db, data.filters);
	});
