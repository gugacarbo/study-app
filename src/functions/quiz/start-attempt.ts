import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import {
	createAttempt,
	findActiveAttemptByExamId,
	getQuestionsForAttempt,
} from "@/db/queries/attempts";
import { getExamById } from "@/db/queries/exams";
import type { Attempt } from "@/features/quiz/types/quiz";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";
import { attemptRowToAttempt, buildAttempt } from "./quiz-helpers";

const startAttemptSchema = z.object({
	examId: z.string().uuid(),
	order: z.enum(["original", "random"]).optional(),
	quantity: z.coerce.number().int().min(0).optional(),
	topicFilter: z.string().nullable().optional(),
	revealMode: z.enum(["during", "after"]).optional(),
});

export async function startAttemptHandler(
	input: z.infer<typeof startAttemptSchema>,
	headers: Headers,
): Promise<Attempt> {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());

	const exam = await getExamById(db, input.examId, session.user.id);
	if (!exam) {
		throw new Response("Not Found", { status: 404 });
	}

	const existing = await findActiveAttemptByExamId(
		db,
		session.user.id,
		input.examId,
	);
	if (existing) {
		return attemptRowToAttempt(existing);
	}

	const baseConfig = {
		order: input.order ?? "original",
		quantity: input.quantity ?? 0,
		topicFilter: input.topicFilter ?? null,
		revealMode: input.revealMode ?? "after",
	};

	const availableQuestions = await getQuestionsForAttempt(db, exam.id, {
		quantity: 0,
		topicFilter: baseConfig.topicFilter,
		order: "original",
	});

	const totalAvailable = availableQuestions.length;
	if (totalAvailable === 0) {
		throw new Response("Unprocessable Entity", { status: 422 });
	}

	const desiredQuantity =
		baseConfig.quantity > 0
			? Math.min(baseConfig.quantity, totalAvailable)
			: totalAvailable;

	const { config } = buildAttempt({ ...baseConfig, quantity: desiredQuantity });

	const attempt = await createAttempt(db, {
		id: crypto.randomUUID(),
		userId: session.user.id,
		examId: exam.id,
		config,
		totalQuestions: desiredQuantity,
	});

	return attemptRowToAttempt(attempt);
}

export const startAttempt = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => startAttemptSchema.parse(data))
	.handler(async ({ data }) => {
		const request = getRequest();
		return startAttemptHandler(data, request.headers);
	});

export { startAttemptSchema };
