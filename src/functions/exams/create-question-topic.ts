import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import { createQuestionTopic } from "@/db/queries/question-topics";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";

export const createQuestionTopicSchema = z.object({
	name: z.string().trim().min(1).max(200),
});

export async function createQuestionTopicHandler(
	input: z.infer<typeof createQuestionTopicSchema>,
	headers: Headers,
) {
	await requireSession(headers);
	const db = createDb(await requireDB());

	const result = await createQuestionTopic(db, input.name);
	return {
		ok: true as const,
		topic: {
			topicId: result.topic.id,
			name: result.topic.name,
			normalizedName: result.topic.normalizedName,
		},
		created: result.created,
	};
}

export const createQuestionTopicServerFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createQuestionTopicSchema.parse(data))
	.handler(async ({ data }) => {
		const request = getRequest();
		return createQuestionTopicHandler(data, request.headers);
	});
