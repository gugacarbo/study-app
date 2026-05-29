import { createServerFn } from "@tanstack/react-start";
import { DBQueries } from "../db/queries";
import { getDB } from "./db";

export const getStats = createServerFn({ method: "GET" }).handler(
	async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		return await queries.getStats();
	},
);

export const getExams = createServerFn({ method: "GET" }).handler(
	async (ctx) => {
		const db = await getDB(ctx);
		if (!db) throw new Error("D1 database not available");

		const queries = new DBQueries(db);
		return await queries.getExams();
	},
);
