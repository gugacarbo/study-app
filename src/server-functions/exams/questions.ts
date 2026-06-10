import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DBQueries } from "../../db/queries";
import { getDB } from "../db";

const scoringModeSchema = z.enum(["exact", "partial"]);

export const updateQuestion = createServerFn({ method: "POST" })
	.inputValidator(
		z.object({
			id: z.number(),
			question: z.string().min(1).optional(),
			options: z.array(z.string()).min(2).optional(),
			answers: z.array(z.string()).min(1).optional(),
			scoringMode: scoringModeSchema.optional(),
			explanation: z.string().optional(),
			deepExplanation: z.string().optional(),
			topic: z.string().optional(),
		}),
	)
	.handler(async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		await queries.updateQuestion(ctx.data.id, ctx.data);
		return { success: true };
	});
