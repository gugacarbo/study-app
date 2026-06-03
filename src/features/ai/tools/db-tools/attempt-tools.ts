import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import type {
	AttemptListItem,
	DBQueries,
	ListAttemptsFilters,
} from "../../../../db/queries";
import {
	optionalTrimmedString,
	pageSchema,
	pageSizeSchema,
	paginatedSuccessSchema,
	safeToolResult,
	toolFailureSchema,
} from "./shared";

const listAttemptsDef = toolDefinition({
	name: "list_attempts",
	description: "List attempts with optional filters and pagination.",
	inputSchema: z.object({
		page: pageSchema,
		pageSize: pageSizeSchema,
		examId: z.coerce.number().int().positive().optional(),
		status: z.enum(["in_progress", "completed", "abandoned"]).optional(),
		startedFrom: optionalTrimmedString,
		startedTo: optionalTrimmedString,
	}),
	outputSchema: z.union([
		paginatedSuccessSchema(
			z.object({
				id: z.number(),
				exam_id: z.number().nullable(),
				topic: z.string().nullable(),
				total_questions: z.number(),
				answered_questions: z.number(),
				correct_answers: z.number(),
				status: z.enum(["in_progress", "completed", "abandoned"]),
				started_at: z.string().nullable(),
				completed_at: z.string().nullable(),
				updated_at: z.string().nullable(),
				accuracy: z.number(),
			}),
		),
		toolFailureSchema,
	]),
});

function normalizeAttemptsFilters(input: {
	page?: unknown;
	pageSize?: unknown;
	examId?: unknown;
	status?: "in_progress" | "completed" | "abandoned";
	startedFrom?: string;
	startedTo?: string;
}): ListAttemptsFilters {
	return {
		page: Number(input.page ?? 1),
		pageSize: Number(input.pageSize ?? 20),
		examId: input.examId === undefined ? undefined : Number(input.examId),
		status: input.status,
		startedFrom: input.startedFrom,
		startedTo: input.startedTo,
	};
}

export function createAttemptTools(queries: DBQueries) {
	const listAttempts = listAttemptsDef.server(async (input) =>
		safeToolResult<AttemptListItem>(() =>
			queries.listAttemptsPaged(normalizeAttemptsFilters(input)),
		),
	);

	return [listAttempts] as const;
}
