import { type ToolSet, tool, zodSchema } from "ai";
import { z } from "zod";
import type { DBQueries, ListAnswerKeysFilters } from "../../../../db/queries";
import {
	mapAnswerKeys,
	optionalTrimmedString,
	pageSchema,
	pageSizeSchema,
	safeToolResult,
} from "./shared";

const listAnswerKeysInputSchema = z.object({
	page: pageSchema,
	pageSize: pageSizeSchema,
	examId: z.coerce.number().int().positive().optional(),
	questionId: z.coerce.number().int().positive().optional(),
	topic: optionalTrimmedString,
	textContains: optionalTrimmedString,
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

export function createQuestionKeysTools(queries: DBQueries): ToolSet {
	return {
		list_answer_keys: tool({
			description:
				"List answer keys with short question excerpts. For subject searches use textContains (matches question text); topic only matches the exact stored topic field and is not a substitute for textContains. After list_questions by topic returns empty, search here with the same text via textContains.",
			inputSchema: zodSchema(listAnswerKeysInputSchema),
			execute: async (input) =>
				safeToolResult(() =>
					queries
						.listAnswerKeysPaged(normalizeAnswerKeysFilters(input))
						.then((result) => ({
							...result,
							items: mapAnswerKeys(result.items),
						})),
				),
		}),
	};
}

export { listAnswerKeysInputSchema };
