import { toolDefinition } from "@tanstack/ai";
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
	paginatedSuccessSchema,
	safeToolResult,
	toolFailureSchema,
} from "./shared";

const listExamsDef = toolDefinition({
	name: "list_exams",
	description: "List exams with optional filters and pagination.",
	inputSchema: z.object({
		page: pageSchema,
		pageSize: pageSizeSchema,
		nameContains: optionalTrimmedString,
		source: optionalTrimmedString,
		createdFrom: optionalTrimmedString,
		createdTo: optionalTrimmedString,
	}),
	outputSchema: z.union([
		paginatedSuccessSchema(
			z.object({
				id: z.number(),
				name: z.string(),
				source: z.string().nullable(),
				created_at: z.string().nullable(),
			}),
		),
		toolFailureSchema,
	]),
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

export function createExamTools(queries: DBQueries) {
	const listExams = listExamsDef.server(async (input) =>
		safeToolResult<ExamRecord>(() =>
			queries.listExamsPaged(normalizeExamsFilters(input)),
		),
	);

	return [listExams] as const;
}
