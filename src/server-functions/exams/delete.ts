import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DBQueries } from "../../db/queries";
import { getDB } from "../db";

export const deleteExam = createServerFn({ method: "POST" })
	.inputValidator(
		z.object({
			id: z.number(),
		}),
	)
	.handler(async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		await queries.deleteExam(ctx.data.id);
		return { success: true };
	});
