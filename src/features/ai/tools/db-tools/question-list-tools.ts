import { tool, zodSchema, type ToolSet } from "ai";
import { z } from "zod";
import type { DBQueries, ListQuestionsFilters } from "../../../../db/queries";
import {
	optionalTrimmedString,
	pageSchema,
	pageSizeSchema,
	safeToolResult,
	sanitizeQuestions,
} from "./shared";

const listQuestionsInputSchema = z.object({
	page: pageSchema,
	pageSize: pageSizeSchema,
	examId: z.coerce.number().int().positive().optional(),
	topic: optionalTrimmedString,
	textContains: optionalTrimmedString,
	createdFrom: optionalTrimmedString,
	createdTo: optionalTrimmedString,
	includeAnswer: z.boolean().default(false),
});

function normalizeQuestionsFilters(input: {
	page?: unknown;
	pageSize?: unknown;
	examId?: unknown;
	topic?: string;
	textContains?: string;
	createdFrom?: string;
	createdTo?: string;
	includeAnswer?: boolean;
}): ListQuestionsFilters {
	return {
		page: Number(input.page ?? 1),
		pageSize: Number(input.pageSize ?? 20),
		examId: input.examId === undefined ? undefined : Number(input.examId),
		topic: input.topic,
		textContains: input.textContains,
		createdFrom: input.createdFrom,
		createdTo: input.createdTo,
		includeAnswer: input.includeAnswer,
	};
}

export function createQuestionListTools(queries: DBQueries): ToolSet {
	return {
		list_questions: tool({
			description:
				"List questions with optional filters and pagination. Includes answers only when includeAnswer=true.",
			inputSchema: zodSchema(listQuestionsInputSchema),
			execute: async (input) => {
				const normalizedFilters = normalizeQuestionsFilters(input);
				return safeToolResult(() =>
					queries.listQuestionsPaged(normalizedFilters).then((result) => ({
						...result,
						items: sanitizeQuestions(
							result.items,
							Boolean(normalizedFilters.includeAnswer),
						),
					})),
				);
			},
		}),
	};
}

export { listQuestionsInputSchema };
