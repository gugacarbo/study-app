import { type ToolSet, tool, zodSchema } from "ai";
import { z } from "zod";
import type {
	DBQueries,
	ExamRecord,
	ListExamsFilters,
} from "../../../../db/queries";
import {
	optionalTrimmedString,
	pageSchema,
	pageSizeSchema,
	safeToolResult,
} from "./shared";

const listExamsInputSchema = z.object({
	page: pageSchema,
	pageSize: pageSizeSchema,
	nameContains: optionalTrimmedString,
	source: optionalTrimmedString,
	createdFrom: optionalTrimmedString,
	createdTo: optionalTrimmedString,
});

function normalizeExamsFilters(input: {
	page?: unknown;
	pageSize?: unknown;
	nameContains?: string;
	source?: string;
	createdFrom?: string;
	createdTo?: string;
}): ListExamsFilters {
	return {
		page: Number(input.page ?? 1),
		pageSize: Number(input.pageSize ?? 20),
		nameContains: input.nameContains,
		source: input.source,
		createdFrom: input.createdFrom,
		createdTo: input.createdTo,
	};
}

export function createExamTools(queries: DBQueries): ToolSet {
	return {
		list_exams: tool({
			description:
				"List exams with optional filters and pagination. Use nameContains to find exams by subject name when topic/textContains searches returned no questions.",
			inputSchema: zodSchema(listExamsInputSchema),
			execute: async (input) =>
				safeToolResult<ExamRecord>(() =>
					queries.listExamsPaged(normalizeExamsFilters(input)),
				),
		}),
	};
}

export { listExamsInputSchema };
