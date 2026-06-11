import { count, desc, eq, gte, like, lte, type SQL, sql } from "drizzle-orm";
import * as schema from "../schema";
import type { DBQueries } from "./base";
import { buildPaginationMeta, normalizePagination, withWhere } from "./helpers";
import type {
	ExamDetail,
	ExamFull,
	ExamRecord,
	FileInfo,
	ListExamsFilters,
	PaginatedResult,
} from "./types";

export function insertExam(
	this: DBQueries,
	name: string,
	source?: string,
): Promise<number> {
	return this.db
		.insert(schema.exams)
		.values({ name, source: source || null })
		.returning({ id: schema.exams.id })
		.get()
		.then((result) => result?.id ?? 0);
}

export function getExamById(
	this: DBQueries,
	id: number,
): Promise<ExamRecord | null> {
	return this.db
		.select()
		.from(schema.exams)
		.where(eq(schema.exams.id, id))
		.get()
		.then((r) => r ?? null);
}

export function getExams(this: DBQueries): Promise<ExamRecord[]> {
	return this.db
		.select()
		.from(schema.exams)
		.orderBy(sql`created_at DESC`)
		.all();
}

export function listExamsPaged(
	this: DBQueries,
	filters: ListExamsFilters = {},
): Promise<PaginatedResult<ExamRecord>> {
	const { page, pageSize, offset } = normalizePagination(filters);
	const conditions: SQL[] = [];

	if (filters.nameContains) {
		conditions.push(like(schema.exams.name, `%${filters.nameContains}%`));
	}
	if (filters.source) {
		conditions.push(eq(schema.exams.source, filters.source));
	}
	if (filters.createdFrom) {
		conditions.push(gte(schema.exams.created_at, filters.createdFrom));
	}
	if (filters.createdTo) {
		conditions.push(lte(schema.exams.created_at, filters.createdTo));
	}

	const whereClause = withWhere(conditions);
	const total = this.db
		.select({ count: count() })
		.from(schema.exams)
		.where(whereClause)
		.get();

	const items = this.db
		.select()
		.from(schema.exams)
		.where(whereClause)
		.orderBy(desc(schema.exams.created_at), desc(schema.exams.id))
		.limit(pageSize)
		.offset(offset)
		.all();

	return Promise.all([total, items]).then(([totalResult, itemsResult]) => ({
		items: itemsResult,
		pagination: buildPaginationMeta(page, pageSize, totalResult?.count ?? 0),
	}));
}

export function getExamsDetailed(this: DBQueries): Promise<ExamDetail[]> {
	return this.getExams().then((exams) => {
		const detailsPromise = this.db
			.select({
				exam_id: schema.questions.exam_id,
				questionCount: count(),
				topics: sql<string>`GROUP_CONCAT(DISTINCT ${schema.questions.topic})`,
			})
			.from(schema.questions)
			.groupBy(schema.questions.exam_id)
			.all();

		const filesPromise = this.db
			.select({
				id: schema.files.id,
				exam_id: schema.files.exam_id,
				name: schema.files.name,
				r2_key: schema.files.r2_key,
				mime_type: schema.files.mime_type,
				size: schema.files.size,
				created_at: schema.files.created_at,
			})
			.from(schema.files)
			.all();

		return Promise.all([detailsPromise, filesPromise]).then(
			([examDetails, allFiles]) => {
				const examDetailMap = new Map(examDetails.map((e) => [e.exam_id, e]));
				const filesByExam = new Map<number, FileInfo[]>();
				for (const file of allFiles) {
					if (file.exam_id === null) continue;
					const list = filesByExam.get(file.exam_id) ?? [];
					list.push(file);
					filesByExam.set(file.exam_id, list);
				}

				return exams.map((exam) => ({
					...exam,
					questionCount: examDetailMap.get(exam.id)?.questionCount ?? 0,
					topics: (examDetailMap.get(exam.id)?.topics ?? "")
						.split(",")
						.filter(Boolean),
					files: filesByExam.get(exam.id) ?? [],
				}));
			},
		);
	});
}

export function getExamFull(
	this: DBQueries,
	examId: number,
): Promise<ExamFull | null> {
	return this.getExamById(examId).then((exam) => {
		if (!exam) return null;

		return Promise.all([
			this.getQuestionsByExam(examId),
			this.getFilesByExam(examId),
			this.getExamStats(examId),
		]).then(([questions, files, stats]) => {
			const topics = [
				...new Set(questions.map((q) => q.topic).filter(Boolean)),
			];

			return {
				...exam,
				questionCount: questions.length,
				topics,
				files,
				questions,
				stats,
			};
		});
	});
}

export function updateExam(
	this: DBQueries,
	id: number,
	data: { name?: string },
): Promise<void> {
	const updates: Record<string, unknown> = {};
	if (data.name !== undefined) updates.name = data.name;

	if (Object.keys(updates).length === 0) return Promise.resolve();

	return this.db
		.update(schema.exams)
		.set(updates)
		.where(eq(schema.exams.id, id))
		.run()
		.then(() => undefined);
}

export function deleteExam(this: DBQueries, id: number): Promise<void> {
	return this.db
		.delete(schema.exams)
		.where(eq(schema.exams.id, id))
		.run()
		.then(() => undefined);
}
