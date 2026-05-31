import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import type {
	AnswerKeyListItem,
	AttemptListItem,
	DBQueries,
	ExamRecord,
	ListAnswerKeysFilters,
	ListAttemptsFilters,
	ListExamsFilters,
	ListQuestionsFilters,
	PaginatedResult,
	QuestionListItem,
} from "../../../../../db/queries";

const TOOL_ERROR_CODE = "TOOL_EXECUTION_FAILED";
const TOOL_ERROR_MESSAGE = "Unable to fetch data right now. Please try again.";

const pageSchema = z.coerce.number().int().min(1).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(50).default(20);

const optionalTrimmedString = z
	.string()
	.optional()
	.transform((value) => {
		if (value === undefined) return undefined;
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	});

const toolErrorSchema = z.object({
	code: z.literal(TOOL_ERROR_CODE),
	message: z.string(),
});

function paginatedSuccessSchema<TItem extends z.ZodTypeAny>(itemSchema: TItem) {
	return z.object({
		ok: z.literal(true),
		data: z.object({
			items: z.array(itemSchema),
			pagination: z.object({
				page: z.number().int(),
				pageSize: z.number().int(),
				totalItems: z.number().int(),
				totalPages: z.number().int(),
				hasNextPage: z.boolean(),
				hasPrevPage: z.boolean(),
			}),
		}),
	});
}

const toolFailureSchema = z.object({
	ok: z.literal(false),
	error: toolErrorSchema,
});

function safeToolResult<TItem>(
	executor: () => Promise<PaginatedResult<TItem>>,
): Promise<
	| { ok: true; data: PaginatedResult<TItem> }
	| { ok: false; error: { code: "TOOL_EXECUTION_FAILED"; message: string } }
> {
	return executor()
		.then((data) => ({ ok: true as const, data }))
		.catch(() => ({
			ok: false as const,
			error: {
				code: TOOL_ERROR_CODE,
				message: TOOL_ERROR_MESSAGE,
			},
		}));
}

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

const listQuestionsDef = toolDefinition({
	name: "list_questions",
	description:
		"List questions with optional filters and pagination. Includes answer only when includeAnswer=true.",
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
				answer: z.string().optional(),
			}),
		),
		toolFailureSchema,
	]),
});

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

const listAttemptsDef = toolDefinition({
	name: "list_attempts",
	description: "List attempts with optional filters and pagination.",
	inputSchema: z.object({
		page: pageSchema,
		pageSize: pageSizeSchema,
		examId: z.coerce.number().int().positive().optional(),
		questionId: z.coerce.number().int().positive().optional(),
		correct: z.boolean().optional(),
		answeredFrom: optionalTrimmedString,
		answeredTo: optionalTrimmedString,
	}),
	outputSchema: z.union([
		paginatedSuccessSchema(
			z.object({
				id: z.number(),
				question_id: z.number().nullable(),
				user_answer: z.string(),
				correct: z.boolean(),
				timestamp: z.string().nullable(),
				exam_id: z.number().nullable(),
				question: z.string(),
				topic: z.string().nullable(),
			}),
		),
		toolFailureSchema,
	]),
});

function toQuestionExcerpt(question: string): string {
	const compact = question.replace(/\s+/g, " ").trim();
	const maxLength = 120;
	if (compact.length <= maxLength) return compact;
	return `${compact.slice(0, maxLength - 3)}...`;
}

function sanitizeQuestions(
	items: QuestionListItem[],
	includeAnswer: boolean,
): Array<Omit<QuestionListItem, "answer"> & { answer?: string }> {
	if (includeAnswer) return items;
	return items.map(({ answer: _answer, ...question }) => question);
}

function mapAnswerKeys(items: AnswerKeyListItem[]) {
	return items.map((item) => ({
		id: item.id,
		exam_id: item.exam_id,
		topic: item.topic,
		answer: item.answer,
		questionExcerpt: toQuestionExcerpt(item.question),
		created_at: item.created_at,
	}));
}

export function createChatDbTools(queries: DBQueries) {
	const normalizeExamsFilters = (input: {
		page?: unknown;
		pageSize?: unknown;
		nameContains?: string;
		source?: string;
		createdFrom?: string;
		createdTo?: string;
	}): ListExamsFilters => ({
		page: Number(input.page ?? 1),
		pageSize: Number(input.pageSize ?? 20),
		nameContains: input.nameContains,
		source: input.source,
		createdFrom: input.createdFrom,
		createdTo: input.createdTo,
	});

	const normalizeQuestionsFilters = (input: {
		page?: unknown;
		pageSize?: unknown;
		examId?: unknown;
		topic?: string;
		textContains?: string;
		createdFrom?: string;
		createdTo?: string;
		includeAnswer?: boolean;
	}): ListQuestionsFilters => ({
		page: Number(input.page ?? 1),
		pageSize: Number(input.pageSize ?? 20),
		examId: input.examId === undefined ? undefined : Number(input.examId),
		topic: input.topic,
		textContains: input.textContains,
		createdFrom: input.createdFrom,
		createdTo: input.createdTo,
		includeAnswer: input.includeAnswer,
	});

	const normalizeAnswerKeysFilters = (input: {
		page?: unknown;
		pageSize?: unknown;
		examId?: unknown;
		questionId?: unknown;
		topic?: string;
		textContains?: string;
	}): ListAnswerKeysFilters => ({
		page: Number(input.page ?? 1),
		pageSize: Number(input.pageSize ?? 20),
		examId: input.examId === undefined ? undefined : Number(input.examId),
		questionId:
			input.questionId === undefined ? undefined : Number(input.questionId),
		topic: input.topic,
		textContains: input.textContains,
	});

	const normalizeAttemptsFilters = (input: {
		page?: unknown;
		pageSize?: unknown;
		examId?: unknown;
		questionId?: unknown;
		correct?: boolean;
		answeredFrom?: string;
		answeredTo?: string;
	}): ListAttemptsFilters => ({
		page: Number(input.page ?? 1),
		pageSize: Number(input.pageSize ?? 20),
		examId: input.examId === undefined ? undefined : Number(input.examId),
		questionId:
			input.questionId === undefined ? undefined : Number(input.questionId),
		correct: input.correct,
		answeredFrom: input.answeredFrom,
		answeredTo: input.answeredTo,
	});

	const listExams = listExamsDef.server(async (input) =>
		safeToolResult<ExamRecord>(() =>
			queries.listExamsPaged(normalizeExamsFilters(input)),
		),
	);

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

	const listAttempts = listAttemptsDef.server(async (input) =>
		safeToolResult<AttemptListItem>(() =>
			queries.listAttemptsPaged(normalizeAttemptsFilters(input)),
		),
	);

	return [listExams, listQuestions, listAnswerKeys, listAttempts] as const;
}
