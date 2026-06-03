import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import type { DBQueries, ListAnswerKeysFilters } from "../../../../db/queries";
import {
	mapAnswerKeys,
	optionalTrimmedString,
	pageSchema,
	pageSizeSchema,
	paginatedSuccessSchema,
	safeToolResult,
	toolFailureSchema,
} from "./shared";

const listAnswerKeysDef = toolDefinition({
	name: "list_answer_keys",
	description:
		"List answer keys with short question excerpts and optional filters.",
	inputSchema: z.object({
		page: pageSchema,
		pageSize: pageSizeSchema,
		examId: z.coerce.number().int().positive().optional(),
		questionId: z.coerce.number().int().positive().optional(),
		topic: optionalTrimmedString,
		textContains: optionalTrimmedString,
	}),
	outputSchema: z.union([
		paginatedSuccessSchema(
			z.object({
				id: z.number(),
				exam_id: z.number().nullable(),
				topic: z.string().nullable(),
				answer: z.string(),
				questionExcerpt: z.string(),
				created_at: z.string().nullable(),
			}),
		),
		toolFailureSchema,
	]),
});

function normalizeAnswerKeysFilters(input: {
	page?: unknown;
	pageSize?: unknown;
	examId?: unknown;
	questionId?: unknown;
	topic?: string;
	textContains?: string;
}): ListAnswerKeysFilters {
	return {
		page: Number(input.page ?? 1),
		pageSize: Number(input.pageSize ?? 20),
		examId: input.examId === undefined ? undefined : Number(input.examId),
		questionId:
			input.questionId === undefined ? undefined : Number(input.questionId),
		topic: input.topic,
		textContains: input.textContains,
	};
}

export function createQuestionKeysTools(queries: DBQueries) {
	const listAnswerKeys = listAnswerKeysDef.server(async (input) => {
		return safeToolResult(() =>
			queries
				.listAnswerKeysPaged(normalizeAnswerKeysFilters(input))
				.then((result) => ({
					...result,
					items: mapAnswerKeys(result.items),
				})),
		);
	});

	return [listAnswerKeys] as const;
}
