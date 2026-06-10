import { count, desc, eq, gte, like, lte, type SQL } from "drizzle-orm";
import * as schema from "../schema";
import type { DBQueries } from "./base";
import { buildPaginationMeta, normalizePagination, withWhere } from "./helpers";
import type {
	AnswerKeyListItem,
	ListAnswerKeysFilters,
	ListQuestionsFilters,
	PaginatedResult,
	QuestionListItem,
} from "./types";

function parseAnswersJson(value: string): string[] {
	const parsed: unknown = JSON.parse(value);
	if (!Array.isArray(parsed)) return [];
	return parsed.filter((entry): entry is string => typeof entry === "string");
}

export function listQuestionsPaged(
	this: DBQueries,
	filters: ListQuestionsFilters = {},
): Promise<PaginatedResult<QuestionListItem>> {
	const { page, pageSize, offset } = normalizePagination(filters);
	const conditions: SQL[] = [];

	if (filters.examId !== undefined) {
		conditions.push(eq(schema.questions.exam_id, filters.examId));
	}
	if (filters.topic) {
		conditions.push(eq(schema.questions.topic, filters.topic));
	}
	if (filters.textContains) {
		conditions.push(
			like(schema.questions.question, `%${filters.textContains}%`),
		);
	}
	if (filters.createdFrom) {
		conditions.push(gte(schema.questions.created_at, filters.createdFrom));
	}
	if (filters.createdTo) {
		conditions.push(lte(schema.questions.created_at, filters.createdTo));
	}

	const whereClause = withWhere(conditions);
	const includeAnswer = Boolean(filters.includeAnswer);
	const totalPromise = this.db
		.select({ count: count() })
		.from(schema.questions)
		.where(whereClause)
		.get();

	const selectFields = {
		id: schema.questions.id,
		exam_id: schema.questions.exam_id,
		question: schema.questions.question,
		options: schema.questions.options,
		explanation: schema.questions.explanation,
		deep_explanation: schema.questions.deep_explanation,
		topic: schema.questions.topic,
		created_at: schema.questions.created_at,
		...(includeAnswer
			? {
					answers: schema.questions.answers,
					scoring_mode: schema.questions.scoring_mode,
				}
			: {}),
	};

	const itemsPromise = this.db
		.select(selectFields)
		.from(schema.questions)
		.where(whereClause)
		.orderBy(desc(schema.questions.created_at), desc(schema.questions.id))
		.limit(pageSize)
		.offset(offset)
		.all();

	return Promise.all([totalPromise, itemsPromise]).then(([total, rows]) => ({
		items: rows.map((row) => ({
			id: row.id,
			exam_id: row.exam_id,
			question: row.question,
			options: JSON.parse(row.options) as string[],
			explanation: row.explanation ?? "",
			deepExplanation: row.deep_explanation ?? "",
			topic: row.topic ?? "",
			created_at: row.created_at,
			...(includeAnswer
				? {
						answers: parseAnswersJson(
							(row as Record<string, unknown>).answers as string,
						),
						scoringMode:
							(row as Record<string, unknown>).scoring_mode === "partial"
								? ("partial" as const)
								: ("exact" as const),
					}
				: {}),
		})) as QuestionListItem[],
		pagination: buildPaginationMeta(page, pageSize, total?.count ?? 0),
	}));
}

export function listAnswerKeysPaged(
	this: DBQueries,
	filters: ListAnswerKeysFilters = {},
): Promise<PaginatedResult<AnswerKeyListItem>> {
	const { page, pageSize, offset } = normalizePagination(filters);
	const conditions: SQL[] = [];

	if (filters.examId !== undefined) {
		conditions.push(eq(schema.questions.exam_id, filters.examId));
	}
	if (filters.questionId !== undefined) {
		conditions.push(eq(schema.questions.id, filters.questionId));
	}
	if (filters.topic) {
		conditions.push(eq(schema.questions.topic, filters.topic));
	}
	if (filters.textContains) {
		conditions.push(
			like(schema.questions.question, `%${filters.textContains}%`),
		);
	}

	const whereClause = withWhere(conditions);
	const totalPromise = this.db
		.select({ count: count() })
		.from(schema.questions)
		.where(whereClause)
		.get();

	const itemsPromise = this.db
		.select({
			id: schema.questions.id,
			exam_id: schema.questions.exam_id,
			topic: schema.questions.topic,
			question: schema.questions.question,
			answers: schema.questions.answers,
			scoring_mode: schema.questions.scoring_mode,
			created_at: schema.questions.created_at,
		})
		.from(schema.questions)
		.where(whereClause)
		.orderBy(desc(schema.questions.created_at), desc(schema.questions.id))
		.limit(pageSize)
		.offset(offset)
		.all();

	return Promise.all([totalPromise, itemsPromise]).then(([total, items]) => ({
		items: items.map((item) => ({
			id: item.id,
			exam_id: item.exam_id,
			topic: item.topic,
			question: item.question,
			answers: parseAnswersJson(item.answers),
			scoringMode:
				item.scoring_mode === "partial"
					? ("partial" as const)
					: ("exact" as const),
			created_at: item.created_at,
		})),
		pagination: buildPaginationMeta(page, pageSize, total?.count ?? 0),
	}));
}
