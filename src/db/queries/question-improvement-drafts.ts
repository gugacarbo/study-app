import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { getOrCreateQuestionTopicFromName } from "@/db/queries/question-topics";
import * as schema from "@/db/schema";

export type QuestionImprovementSnapshot = {
	question: string;
	options: Array<{ key: string; text: string }>;
	answers: string[];
	topicId?: string | null;
	topic: string | null;
	scoringMode: "exact" | "partial";
	explanation: string | null;
	deepExplanation: string | null;
};

export type QuestionImprovementDraftRecord = {
	id: string;
	userId: string;
	examId: string;
	questionId: string;
	jobId: string;
	status: "pending_review" | "approved" | "discarded";
	originalSnapshot: QuestionImprovementSnapshot;
	improvedSnapshot: QuestionImprovementSnapshot;
	summary: string | null;
	metadata: string | null;
	createdAt: string | null;
	updatedAt: string | null;
};

function parseSnapshot(raw: string): QuestionImprovementSnapshot {
	return JSON.parse(raw) as QuestionImprovementSnapshot;
}

function mapDraftRow(
	row: typeof schema.questionImprovementDrafts.$inferSelect,
): QuestionImprovementDraftRecord {
	return {
		id: row.id,
		userId: row.userId,
		examId: row.examId,
		questionId: row.questionId,
		jobId: row.jobId,
		status: row.status as QuestionImprovementDraftRecord["status"],
		originalSnapshot: parseSnapshot(row.originalSnapshot),
		improvedSnapshot: parseSnapshot(row.improvedSnapshot),
		summary: row.summary,
		metadata: row.metadata,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export async function upsertPendingQuestionImprovementDraft(
	db: AppDatabase,
	input: {
		id: string;
		userId: string;
		examId: string;
		questionId: string;
		jobId: string;
		originalSnapshot: QuestionImprovementSnapshot;
		improvedSnapshot: QuestionImprovementSnapshot;
		summary: string | null;
		metadata: string | null;
	},
): Promise<QuestionImprovementDraftRecord> {
	await db
		.delete(schema.questionImprovementDrafts)
		.where(
			and(
				eq(schema.questionImprovementDrafts.userId, input.userId),
				eq(schema.questionImprovementDrafts.questionId, input.questionId),
				eq(schema.questionImprovementDrafts.status, "pending_review"),
			),
		);

	await db.insert(schema.questionImprovementDrafts).values({
		id: input.id,
		userId: input.userId,
		examId: input.examId,
		questionId: input.questionId,
		jobId: input.jobId,
		status: "pending_review",
		originalSnapshot: JSON.stringify(input.originalSnapshot),
		improvedSnapshot: JSON.stringify(input.improvedSnapshot),
		summary: input.summary,
		metadata: input.metadata,
	});

	const row = await db.query.questionImprovementDrafts.findFirst({
		where: (drafts, { eq: equal }) => equal(drafts.id, input.id),
	});
	if (!row) {
		throw new Error("Failed to load upserted question improvement draft");
	}
	return mapDraftRow(row);
}

export async function getPendingQuestionImprovementDraftsByExam(
	db: AppDatabase,
	examId: string,
	userId: string,
): Promise<QuestionImprovementDraftRecord[]> {
	const rows = await db
		.select()
		.from(schema.questionImprovementDrafts)
		.where(
			and(
				eq(schema.questionImprovementDrafts.examId, examId),
				eq(schema.questionImprovementDrafts.userId, userId),
				eq(schema.questionImprovementDrafts.status, "pending_review"),
			),
		);

	return rows.map(mapDraftRow);
}

export async function getPendingQuestionImprovementDraftByQuestion(
	db: AppDatabase,
	input: {
		userId: string;
		examId: string;
		questionId: string;
		jobId?: string;
	},
): Promise<QuestionImprovementDraftRecord | null> {
	const row = await db.query.questionImprovementDrafts.findFirst({
		where: (drafts, { and: all, eq: equal }) =>
			all(
				equal(drafts.userId, input.userId),
				equal(drafts.examId, input.examId),
				equal(drafts.questionId, input.questionId),
				equal(drafts.status, "pending_review"),
				...(input.jobId ? [equal(drafts.jobId, input.jobId)] : []),
			),
	});

	return row ? mapDraftRow(row) : null;
}

export async function updatePendingQuestionImprovementDraftExplanations(
	db: AppDatabase,
	input: {
		userId: string;
		examId: string;
		questionId: string;
		jobId?: string;
		explanation: string | null;
		deepExplanation: string | null;
		summary: string | null;
		metadata: string | null;
	},
): Promise<QuestionImprovementDraftRecord> {
	const draft = await getPendingQuestionImprovementDraftByQuestion(db, {
		userId: input.userId,
		examId: input.examId,
		questionId: input.questionId,
		jobId: input.jobId,
	});
	if (!draft) {
		throw new Error("Pending question improvement draft was not found");
	}

	const nextSnapshot = {
		...draft.improvedSnapshot,
		explanation: input.explanation,
		deepExplanation: input.deepExplanation,
	};

	await db
		.update(schema.questionImprovementDrafts)
		.set({
			improvedSnapshot: JSON.stringify(nextSnapshot),
			summary: input.summary,
			metadata: input.metadata,
			updatedAt: sql`CURRENT_TIMESTAMP`,
		})
		.where(eq(schema.questionImprovementDrafts.id, draft.id));

	const updated = await db.query.questionImprovementDrafts.findFirst({
		where: (drafts, { eq: equal }) => equal(drafts.id, draft.id),
	});
	if (!updated) {
		throw new Error("Failed to load updated question improvement draft");
	}
	return mapDraftRow(updated);
}

async function getOwnedDraft(
	db: AppDatabase,
	draftId: string,
	userId: string,
): Promise<QuestionImprovementDraftRecord | null> {
	const row = await db.query.questionImprovementDrafts.findFirst({
		where: (drafts, { and: all, eq: equal }) =>
			all(equal(drafts.id, draftId), equal(drafts.userId, userId)),
	});
	return row ? mapDraftRow(row) : null;
}

export async function applyQuestionImprovementDraft(
	db: AppDatabase,
	input: { draftId: string; userId: string },
): Promise<boolean> {
	const draft = await getOwnedDraft(db, input.draftId, input.userId);
	if (!draft || draft.status !== "pending_review") return false;
	const resolvedTopic =
		draft.improvedSnapshot.topicId != null
			? { id: draft.improvedSnapshot.topicId }
			: await getOrCreateQuestionTopicFromName(
					db,
					draft.improvedSnapshot.topic,
				);

	await db
		.update(schema.questions)
		.set({
			question: draft.improvedSnapshot.question,
			options: JSON.stringify(draft.improvedSnapshot.options),
			answers: JSON.stringify(draft.improvedSnapshot.answers),
			scoringMode: draft.improvedSnapshot.scoringMode,
			topic: null,
			topicId: resolvedTopic?.id ?? null,
			explanation: draft.improvedSnapshot.explanation,
			deepExplanation: draft.improvedSnapshot.deepExplanation,
		})
		.where(eq(schema.questions.id, draft.questionId));

	await db
		.update(schema.questionImprovementDrafts)
		.set({
			status: "approved",
			updatedAt: sql`CURRENT_TIMESTAMP`,
		})
		.where(eq(schema.questionImprovementDrafts.id, draft.id));

	return true;
}

export async function discardQuestionImprovementDraft(
	db: AppDatabase,
	input: { draftId: string; userId: string },
): Promise<boolean> {
	const draft = await getOwnedDraft(db, input.draftId, input.userId);
	if (!draft || draft.status !== "pending_review") return false;

	await db
		.update(schema.questionImprovementDrafts)
		.set({
			status: "discarded",
			updatedAt: sql`CURRENT_TIMESTAMP`,
		})
		.where(eq(schema.questionImprovementDrafts.id, draft.id));

	return true;
}
