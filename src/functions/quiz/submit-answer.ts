import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import {
	findAttemptById,
	recordAttemptAnswer,
	updateAttemptCounters,
} from "@/db/queries/attempts";
import { getQuestionById } from "@/db/queries/questions";
import { parseQuestionRow } from "@/features/exams/lib/parse-question-fields";
import type { AttemptAnswer, SubmitAnswerInput } from "@/features/quiz/types/quiz";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";
import { calculateCredit } from "./quiz-helpers";

export type { SubmitAnswerInput };

const submitAnswerSchema = z.object({
	attemptId: z.string().uuid(),
	questionId: z.string().uuid(),
	selectedOptions: z.array(z.string().trim().min(1)).min(1),
});

export async function submitAnswerHandler(
	input: z.infer<typeof submitAnswerSchema>,
	headers: Headers,
): Promise<AttemptAnswer> {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());

	const attempt = await findAttemptById(db, input.attemptId);
	if (!attempt || attempt.userId !== session.user.id) {
		throw new Response("Not Found", { status: 404 });
	}
	if (attempt.status !== "in_progress") {
		throw new Response("Conflict", { status: 409 });
	}

	const question = await getQuestionById(db, input.questionId);
	if (!question || question.examId !== attempt.examId) {
		throw new Response("Unprocessable Entity", { status: 422 });
	}

	const parsed = parseQuestionRow(question);
	if (!parsed) {
		throw new Response("Unprocessable Entity", { status: 422 });
	}

	const selectedSet = new Set(input.selectedOptions);
	const selectedSorted = Array.from(selectedSet).sort();
	const credit = calculateCredit(parsed.answers, selectedSorted);
	const isCorrect = credit >= 1;

	const row = await recordAttemptAnswer(db, {
		attemptId: attempt.id,
		questionId: question.id,
		userAnswer: JSON.stringify(selectedSorted),
		correct: isCorrect,
		credit,
	});

	await updateAttemptCounters(db, attempt.id);

	return {
		id: row.id,
		attemptId: row.attemptId,
		questionId: row.questionId,
		selectedOptionIds: JSON.parse(row.userAnswer) as string[],
		credit: row.credit ?? 0,
		correct: row.correct,
		answeredAt: row.answeredAt ?? new Date().toISOString(),
	};
}

export const submitAnswer = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => submitAnswerSchema.parse(data))
	.handler(async ({ data }) => {
		const request = getRequest();
		return submitAnswerHandler(data, request.headers);
	});

export { submitAnswerSchema };
