import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import { getExamWithQuestions } from "@/db/queries/exams";
import { parseQuestionRow } from "@/features/exams/lib/parse-question-fields";
import type { ExamDetail } from "@/features/exams/types/exam-detail";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";

const getExamSchema = z.object({
	examId: z.string().uuid(),
});

export async function getExamHandler(
	input: z.infer<typeof getExamSchema>,
	headers: Headers,
): Promise<ExamDetail> {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());
	const exam = await getExamWithQuestions(db, input.examId, session.user.id);

	if (!exam) {
		throw new Response("Not Found", { status: 404 });
	}

	const questions = [];
	for (const row of exam.questions) {
		const parsed = parseQuestionRow(row);
		if (parsed) {
			questions.push(parsed);
			continue;
		}
		console.warn(
			`getExam: skipping question ${row.id} with invalid options/answers JSON`,
		);
	}

	return {
		id: exam.id,
		name: exam.name,
		createdAt: exam.createdAt,
		questionCount: questions.length,
		questions,
	};
}

export const getExam = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getExamSchema.parse(data))
	.handler(async ({ data }) => {
		const request = getRequest();
		return getExamHandler(data, request.headers);
	});

export { getExamSchema };
