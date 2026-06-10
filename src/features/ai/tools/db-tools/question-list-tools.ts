import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import type { DBQueries, ListQuestionsFilters } from "../../../../db/queries";
import {
	optionalTrimmedString,
	pageSchema,
	pageSizeSchema,
	paginatedSuccessSchema,
	safeToolResult,
	sanitizeQuestions,
	toolFailureSchema,
} from "./shared";

const listQuestionsDef = toolDefinition({
	name: "list_questions",
	description:
		"List questions with optional filters and pagination. Includes answers only when includeAnswer=true.",
	inputSchema: z.object({
		page: pageSchema,
		pageSize: pageSizeSchema,
		examId: z.coerce.number().int().positive().optional(),
		topic: optionalTrimmedString,
		textContains: optionalTrimmedString,
		createdFrom: optionalTrimmedString,
		createdTo: optionalTrimmedString,
		includeAnswer: z.boolean().default(false),
	}),
	outputSchema: z.union([
		paginatedSuccessSchema(
			z.object({
				id: z.number(),
				exam_id: z.number().nullable(),
				question: z.string(),
				options: z.array(z.string()),
				explanation: z.string(),
				deepExplanation: z.string(),
				topic: z.string(),
				created_at: z.string().nullable(),
				answers: z.array(z.string()).optional(),
			}),
		),
		toolFailureSchema,
	]),
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

export function createQuestionListTools(queries: DBQueries) {
	const listQuestions = listQuestionsDef.server(async (input) => {
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
	});

	return [listQuestions] as const;
}
