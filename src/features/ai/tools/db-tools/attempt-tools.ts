import { type ToolSet, tool, zodSchema } from "ai";
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
	safeToolResult,
} from "./shared";

const listAttemptsInputSchema = z.object({
	page: pageSchema,
	pageSize: pageSizeSchema,
	examId: z.coerce.number().int().positive().optional(),
	status: z.enum(["in_progress", "completed", "abandoned"]).optional(),
	startedFrom: optionalTrimmedString,
	startedTo: optionalTrimmedString,
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

export function createAttemptTools(queries: DBQueries): ToolSet {
	return {
		list_attempts: tool({
			description: "List attempts with optional filters and pagination.",
			inputSchema: zodSchema(listAttemptsInputSchema),
			execute: async (input) =>
				safeToolResult<AttemptListItem>(() =>
					queries.listAttemptsPaged(normalizeAttemptsFilters(input)),
				),
		}),
	};
}

export { listAttemptsInputSchema };
