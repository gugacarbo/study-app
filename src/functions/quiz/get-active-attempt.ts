import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import {
	findActiveAttemptByExamId,
	getAttemptAnswers,
} from "@/db/queries/attempts";
import { getExamById } from "@/db/queries/exams";
import type { ActiveAttempt } from "@/features/quiz/types/quiz";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";
import { attemptRowToAttempt, selectAndOrderQuestions } from "./quiz-helpers";

export type ActiveAttemptData = ActiveAttempt;

const getActiveAttemptSchema = z.object({
	examId: z.string().uuid(),
});

export async function getActiveAttemptHandler(
	input: z.infer<typeof getActiveAttemptSchema>,
	headers: Headers,
): Promise<ActiveAttemptData | null> {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());

	const exam = await getExamById(db, input.examId, session.user.id);
	if (!exam) {
		throw new Response("Not Found", { status: 404 });
	}

	const attemptRow = await findActiveAttemptByExamId(
		db,
		session.user.id,
		input.examId,
	);
	if (!attemptRow) {
		return null;
	}

	const attempt = attemptRowToAttempt(attemptRow);
	const questions = await selectAndOrderQuestions(
		db,
		input.examId,
		attempt.config,
	);
	const answers = await getAttemptAnswers(db, attempt.id);
	const answerMap = new Map(answers.map((a) => [a.questionId, a.userAnswer]));

	return {
		attempt,
		questions: questions.map((q) => ({
			...q,
			selectedOptionIds: answerMap.get(q.id)
				? JSON.parse(answerMap.get(q.id) as string)
				: [],
		})),
	};
}

export const getActiveAttempt = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getActiveAttemptSchema.parse(data))
	.handler(async ({ data }) => {
		const request = getRequest();
		return getActiveAttemptHandler(data, request.headers);
	});

export { getActiveAttemptSchema };
