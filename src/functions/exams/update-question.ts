import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import { getQuestionById, updateQuestionById } from "@/db/queries/questions";
import { parseQuestionRow } from "@/features/exams/lib/parse-question-fields";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";

const optionSchema = z.object({
	key: z.string().trim().length(1).regex(/^[A-Z]$/),
	text: z.string().trim().min(1).max(1000),
	explanation: z.string().trim().max(1000).optional().nullable(),
});

export const updateQuestionSchema = z
	.object({
		examId: z.string().uuid(),
		questionId: z.string().uuid(),
		question: z.string().trim().min(1).max(5000),
		topicId: z.string().uuid().optional().nullable(),
		scoringMode: z.enum(["exact", "partial"]),
		options: z.array(optionSchema).min(2).max(10),
		answers: z.array(z.string().trim().min(1)).min(1),
		explanation: z.string().trim().max(10000).optional().nullable(),
		deepExplanation: z.string().trim().max(10000).optional().nullable(),
	})
	.superRefine((data, ctx) => {
		const optionKeys = new Set(data.options.map((option) => option.key));

		for (let i = 0; i < data.answers.length; i++) {
			const answer = data.answers[i];
			if (!answer || !optionKeys.has(answer)) {
				ctx.addIssue({
					code: "custom",
					message: "answer key not found in options",
					path: ["answers", i],
				});
			}
		}

		if (data.scoringMode === "exact" && data.answers.length !== 1) {
			ctx.addIssue({
				code: "custom",
				message: "exact scoring requires exactly one answer",
				path: ["answers"],
			});
		}
	});

export async function updateQuestionHandler(
	input: z.infer<typeof updateQuestionSchema>,
	headers: Headers,
): Promise<QuestionDetail> {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());

	const updated = await updateQuestionById(db, {
		questionId: input.questionId,
		userId: session.user.id,
		question: input.question,
		options: JSON.stringify(input.options),
		answers: JSON.stringify(input.answers),
		scoringMode: input.scoringMode,
		topicId: input.topicId ?? null,
		explanation: input.explanation ?? null,
		deepExplanation: input.deepExplanation ?? null,
	});

	if (!updated) {
		throw new Response("Not Found", { status: 404 });
	}

	const row = await getQuestionById(db, input.questionId);

	if (!row) {
		throw new Response("Not Found", { status: 404 });
	}

	const parsed = parseQuestionRow(row);
	if (!parsed) {
		throw new Response("Unprocessable Entity", { status: 422 });
	}

	return parsed;
}

export const updateQuestion = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateQuestionSchema.parse(data))
	.handler(async ({ data }) => {
		const request = getRequest();
		return updateQuestionHandler(data, request.headers);
	});
