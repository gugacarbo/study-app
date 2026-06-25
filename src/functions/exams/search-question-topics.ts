import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createDb } from "@/db/client";
import { searchSimilarQuestionTopics } from "@/db/queries/question-topics";
import { requireDB } from "@/functions/db";
import { requireSession } from "@/lib/rbac";

export const searchQuestionTopicsSchema = z.object({
	query: z.string().trim().min(1).max(200),
	limit: z.number().int().min(1).max(10).optional(),
});

export async function searchQuestionTopicsHandler(
	input: z.infer<typeof searchQuestionTopicsSchema>,
	headers: Headers,
) {
	await requireSession(headers);
	const db = createDb(await requireDB());

	const topics = await searchSimilarQuestionTopics(db, input);
	return topics.map((topic) => ({
		topicId: topic.id,
		name: topic.name,
		normalizedName: topic.normalizedName,
		similarityLabel: topic.similarityLabel,
	}));
}

export const searchQuestionTopics = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => searchQuestionTopicsSchema.parse(data))
	.handler(async ({ data }) => {
		const request = getRequest();
		return searchQuestionTopicsHandler(data, request.headers);
	});
