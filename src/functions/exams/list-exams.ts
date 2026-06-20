import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createDb } from "@/db/client";
import { listExamsByUserId } from "@/db/queries/exams";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";

export async function listExamsHandler(headers: Headers) {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());
	return listExamsByUserId(db, session.user.id);
}

export const listExams = createServerFn({ method: "GET" }).handler(async () =>
	listExamsHandler(getRequest().headers),
);
