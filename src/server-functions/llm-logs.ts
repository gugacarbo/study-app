import { createServerFn } from "@tanstack/react-start";
import { DBQueries } from "@/db/queries";
import { getLlmLogSchema, listLlmLogsSchema } from "@/lib/validation";
import { getDB } from "./db";

export const listLlmLogs = createServerFn({ method: "GET" })
	.inputValidator(listLlmLogsSchema)
	.handler(async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		return queries.listLLMLogsPaged(ctx.data);
	});

export const getLlmLog = createServerFn({ method: "POST" })
	.inputValidator(getLlmLogSchema)
	.handler(async (ctx) => {
		const { data } = ctx;
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		const log = await queries.getLLMLogById(data.id);
		if (!log) throw new Error("LLM log not found");
		return log;
	});
