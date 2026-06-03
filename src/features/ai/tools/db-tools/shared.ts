import { z } from "zod";
import type {
	AnswerKeyListItem,
	PaginatedResult,
	QuestionListItem,
} from "../../../../db/queries";

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
		.catch((error) => {
			console.error("DB tool execution failed:", error);
			return {
				ok: false as const,
				error: {
					code: TOOL_ERROR_CODE,
					message: TOOL_ERROR_MESSAGE,
				},
			};
		});
}

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

export {
	mapAnswerKeys,
	optionalTrimmedString,
	pageSchema,
	pageSizeSchema,
	paginatedSuccessSchema,
	safeToolResult,
	sanitizeQuestions,
	TOOL_ERROR_CODE,
	TOOL_ERROR_MESSAGE,
	toolErrorSchema,
	toolFailureSchema,
	toQuestionExcerpt,
};
