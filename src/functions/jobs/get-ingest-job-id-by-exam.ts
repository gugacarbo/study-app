import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import { getIngestJobIdByExamId } from "@/db/queries/jobs";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";

export const getIngestJobIdByExam = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z.object({ examId: z.string().uuid() }).parse(data),
	)
	.handler(async ({ data }) => {
		const request = getRequest();
		const session = await requireSession(request.headers);
		const db = createDb(await requireDB());
		return getIngestJobIdByExamId(db, session.user.id, data.examId);
	});
