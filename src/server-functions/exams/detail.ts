import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DBQueries } from "../../db/queries";
import { getDB } from "../db";

export const getExamDetail = createServerFn({ method: "GET" })
	.inputValidator(
		z.object({
			id: z.coerce.number().int().positive(),
		}),
	)
	.handler(async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		const exam = await queries.getExamFull(ctx.data.id);
		if (!exam) throw new Error("Exam not found");
		return exam;
	});

export const getExamsDetailed = createServerFn({ method: "GET" }).handler(
	async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		return await queries.getExamsDetailed();
	},
);
