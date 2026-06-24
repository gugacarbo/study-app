import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createDb } from "@/db/client";
import { listExamsByUserId } from "@/db/queries/exams";
import { getQuizStatsByUserId } from "@/db/queries/attempts";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";

export async function getStatsHandler(headers: Headers) {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());
	return getQuizStatsByUserId(db, session.user.id);
}

export async function getExamsHandler(headers: Headers) {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());
	return listExamsByUserId(db, session.user.id);
}

export const getStats = createServerFn({ method: "GET" }).handler(async () =>
	getStatsHandler(getRequest().headers),
);

export const getExams = createServerFn({ method: "GET" }).handler(async () =>
	getExamsHandler(getRequest().headers),
);
