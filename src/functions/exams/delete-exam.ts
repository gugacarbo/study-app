import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import { deleteExamById } from "@/db/queries/exams";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";

export const deleteExamSchema = z.object({
	examId: z.string().uuid(),
});

export async function deleteExamHandler(
	input: z.infer<typeof deleteExamSchema>,
	headers: Headers,
) {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());
	const deleted = await deleteExamById(db, input.examId, session.user.id);

	if (!deleted) {
		throw new Response("Not Found", { status: 404 });
	}

	return { success: true as const };
}

export const deleteExam = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteExamSchema.parse(data))
	.handler(async ({ data }) => {
		const request = getRequest();
		return deleteExamHandler(data, request.headers);
	});
