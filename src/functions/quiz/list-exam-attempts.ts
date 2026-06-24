import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import { listAttemptsByExamId } from "@/db/queries/attempts";
import { getExamById } from "@/db/queries/exams";
import type { AttemptSummary } from "@/features/quiz/types/quiz";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";

const listExamAttemptsSchema = z.object({
	examId: z.string().uuid(),
});

export async function listExamAttemptsHandler(
	input: z.infer<typeof listExamAttemptsSchema>,
	headers: Headers,
): Promise<AttemptSummary[]> {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());

	const exam = await getExamById(db, input.examId, session.user.id);
	if (!exam) {
		throw new Response("Not Found", { status: 404 });
	}

	const rows = await listAttemptsByExamId(db, session.user.id, input.examId);

	return rows.map((row, index) => {
		const status =
			row.status === "completed" ? ("completed" as const) : ("in_progress" as const);
		const scorePercent =
			status === "completed" && row.answeredQuestions > 0
				? Math.round((row.correctAnswers / row.answeredQuestions) * 100)
				: 0;

		return {
			id: row.id,
			status,
			totalQuestions: row.totalQuestions,
			answeredQuestions: row.answeredQuestions,
			correctAnswers: row.correctAnswers,
			scorePercent,
			startedAt: row.startedAt,
			number: index + 1,
			accuracy: scorePercent,
		};
	});
}

export const listExamAttempts = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => listExamAttemptsSchema.parse(data))
	.handler(async ({ data }) => {
		const request = getRequest();
		return listExamAttemptsHandler(data, request.headers);
	});

export { listExamAttemptsSchema };
