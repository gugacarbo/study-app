import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import { findAttemptById } from "@/db/queries/attempts";
import type { AttemptResult } from "@/features/quiz/types/quiz";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";
import { buildAttemptResult } from "./quiz-helpers";

const getAttemptResultSchema = z.object({
	attemptId: z.string().uuid(),
});

export async function getAttemptResultHandler(
	input: z.infer<typeof getAttemptResultSchema>,
	headers: Headers,
): Promise<AttemptResult> {
	const session = await requireSession(headers);
	const db = createDb(await requireDB());

	const attempt = await findAttemptById(db, input.attemptId);
	if (!attempt || attempt.userId !== session.user.id) {
		throw new Response("Not Found", { status: 404 });
	}
	if (attempt.status !== "completed") {
		throw new Response("Conflict", { status: 409 });
	}

	return buildAttemptResult(db, attempt);
}

export const getAttemptResult = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getAttemptResultSchema.parse(data))
	.handler(async ({ data }) => {
		const request = getRequest();
		return getAttemptResultHandler(data, request.headers);
	});

export { getAttemptResultSchema };
