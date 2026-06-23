import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import { completeAttempt, findAttemptById } from "@/db/queries/attempts";
import type { AttemptResult } from "@/features/quiz/types/quiz";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";
import { buildAttemptResult } from "./quiz-helpers";

export type { AttemptResult };

const finishAttemptSchema = z.object({
	attemptId: z.string().uuid(),
});

export async function finishAttemptHandler(
	input: z.infer<typeof finishAttemptSchema>,
	headers: Headers,
): Promise<AttemptResult> {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());

	const attempt = await findAttemptById(db, input.attemptId);
	if (!attempt || attempt.userId !== session.user.id) {
		throw new Response("Not Found", { status: 404 });
	}
	if (attempt.status !== "in_progress") {
		throw new Response("Conflict", { status: 409 });
	}

	const completed = await completeAttempt(db, attempt.id);
	return buildAttemptResult(db, completed);
}

export const finishAttempt = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => finishAttemptSchema.parse(data))
	.handler(async ({ data }) => {
		const request = getRequest();
		return finishAttemptHandler(data, request.headers);
	});

export { finishAttemptSchema };
