import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DBQueries } from "../../db/queries";
import { getDB } from "../db";

export const updateExam = createServerFn({ method: "POST" })
	.inputValidator(
		z.object({
			id: z.number(),
			name: z.string().min(1),
		}),
	)
	.handler(async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		await queries.updateExam(ctx.data.id, { name: ctx.data.name });
		return { success: true };
	});
