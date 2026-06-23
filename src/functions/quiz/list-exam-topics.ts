import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import { listDistinctTopicsByExamId } from "@/db/queries/attempts";
import { getExamById } from "@/db/queries/exams";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";

const listExamTopicsSchema = z.object({
	examId: z.string().uuid(),
});

export async function listExamTopicsHandler(
	input: z.infer<typeof listExamTopicsSchema>,
	headers: Headers,
): Promise<string[]> {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());

	const exam = await getExamById(db, input.examId, session.user.id);
	if (!exam) {
		throw new Response("Not Found", { status: 404 });
	}

	return listDistinctTopicsByExamId(db, input.examId);
}

export const listExamTopics = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => listExamTopicsSchema.parse(data))
	.handler(async ({ data }) => {
		const request = getRequest();
		return listExamTopicsHandler(data, request.headers);
	});

export { listExamTopicsSchema };
