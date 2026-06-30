import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createExam } from "@/db/queries/exams";
import { createId } from "@/db/queries/helpers";
import {
	discardQuestionImprovementDraft,
	getPendingQuestionImprovementDraftsByExam,
	resolveQuestionImprovementDraft,
	upsertPendingQuestionImprovementDraft,
} from "@/db/queries/question-improvement-drafts";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";

async function seedUser(db: ReturnType<typeof createTestDb>, userId: string) {
	await db.insert(schema.user).values({
		id: userId,
		name: "User",
		email: `${userId}@aluno.ifsc.edu.br`,
		emailVerified: true,
	});
}

async function seedQuestion(input: {
	db: ReturnType<typeof createTestDb>;
	userId: string;
}) {
	const examId = createId();
	await createExam(input.db, { id: examId, userId: input.userId, name: "Prova" });

	const questionId = createId();
	const original = {
		question: "Quanto é 2 + 2?",
		options: [
			{ key: "A", text: "3" },
			{ key: "B", text: "4" },
		],
		answers: ["B"],
		topic: "Aritmética",
		scoringMode: "exact" as const,
		explanation: null,
		deepExplanation: null,
	};

	await input.db.insert(schema.questions).values({
		id: questionId,
		examId,
		question: original.question,
		options: JSON.stringify(original.options),
		answers: JSON.stringify(original.answers),
		scoringMode: original.scoringMode,
		topic: original.topic,
		explanation: original.explanation,
		deepExplanation: original.deepExplanation,
	});

	return { examId, questionId, original };
}

describe("question improvement drafts queries", () => {
	it("upserts one pending draft per question", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);
		const { examId, questionId, original } = await seedQuestion({ db, userId });

		const firstJobId = createId();
		const secondJobId = createId();

		await upsertPendingQuestionImprovementDraft(db, {
			id: createId(),
			userId,
			examId,
			questionId,
			jobId: firstJobId,
			originalSnapshot: original,
			improvedSnapshot: {
				...original,
				question: "Quanto é 2 + 2, em números inteiros?",
			},
			summary: "Refinei o enunciado.",
			metadata: JSON.stringify({ agentRunId: "run-1" }),
		});

		await upsertPendingQuestionImprovementDraft(db, {
			id: createId(),
			userId,
			examId,
			questionId,
			jobId: secondJobId,
			originalSnapshot: original,
			improvedSnapshot: {
				...original,
				question: "Quanto é dois mais dois?",
			},
			summary: "Reescrevi a pergunta.",
			metadata: JSON.stringify({ agentRunId: "run-2" }),
		});

		const drafts = await getPendingQuestionImprovementDraftsByExam(
			db,
			examId,
			userId,
		);
		expect(drafts).toHaveLength(1);
		expect(drafts[0]).toMatchObject({
			jobId: secondJobId,
			questionId,
			summary: "Reescrevi a pergunta.",
			improvedSnapshot: expect.objectContaining({
				question: "Quanto é dois mais dois?",
			}),
		});
	});

	it("applies a reviewed final snapshot to the original question and marks draft approved", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);
		const { examId, questionId, original } = await seedQuestion({ db, userId });

		const draft = await upsertPendingQuestionImprovementDraft(db, {
			id: createId(),
			userId,
			examId,
			questionId,
			jobId: createId(),
			originalSnapshot: original,
			improvedSnapshot: {
				question: "Quanto é 2 + 2? (versão melhorada)",
				options: [
					{ key: "A", text: "2" },
					{ key: "B", text: "4" },
					{ key: "C", text: "6" },
				],
				answers: ["B"],
				topic: "Matemática básica",
				scoringMode: "exact",
				explanation: "2 + 2 resulta em 4.",
				deepExplanation: "A soma de dois inteiros positivos iguais a 2 resulta em 4.",
			},
			summary: "Melhorei enunciado, opções e explicações.",
			metadata: null,
		});

		const applied = await resolveQuestionImprovementDraft(db, {
			draftId: draft.id,
			userId,
			action: "approve",
			finalSnapshot: {
				question: "Quanto e 2 + 2? (revisada manualmente)",
				options: [
					{ key: "A", text: "1" },
					{ key: "B", text: "4" },
					{ key: "C", text: "5" },
				],
				answers: ["B"],
				topic: "Aritmetica revisada",
				scoringMode: "exact",
				explanation: "A soma correta e 4.",
				deepExplanation: "Somando 2 com 2, chegamos ao resultado 4.",
			},
		});
		expect(applied).toBe(true);

		const [questionRow] = await db
			.select()
			.from(schema.questions)
			.where(eq(schema.questions.id, questionId));
		expect(questionRow).toMatchObject({
			question: "Quanto e 2 + 2? (revisada manualmente)",
			scoringMode: "exact",
			topic: null,
			topicId: expect.any(String),
			explanation: "A soma correta e 4.",
			deepExplanation: "Somando 2 com 2, chegamos ao resultado 4.",
		});

		const [draftRow] = await db
			.select()
			.from(schema.questionImprovementDrafts)
			.where(eq(schema.questionImprovementDrafts.id, draft.id));
		expect(draftRow?.status).toBe("approved");
	});

	it("rejects approval when final snapshot is missing", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);
		const { examId, questionId, original } = await seedQuestion({ db, userId });

		const draft = await upsertPendingQuestionImprovementDraft(db, {
			id: createId(),
			userId,
			examId,
			questionId,
			jobId: createId(),
			originalSnapshot: original,
			improvedSnapshot: {
				...original,
				question: "Pergunta sem snapshot final",
			},
			summary: null,
			metadata: null,
		});

		await expect(
			resolveQuestionImprovementDraft(db, {
				draftId: draft.id,
				userId,
				action: "approve",
			}),
		).rejects.toThrow(/final snapshot/i);
	});

	it("marks a pending draft as discarded without changing the original question", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);
		const { examId, questionId, original } = await seedQuestion({ db, userId });

		const draft = await upsertPendingQuestionImprovementDraft(db, {
			id: createId(),
			userId,
			examId,
			questionId,
			jobId: createId(),
			originalSnapshot: original,
			improvedSnapshot: {
				...original,
				question: "Pergunta descartada",
			},
			summary: "Teste de descarte.",
			metadata: null,
		});

		const discarded = await discardQuestionImprovementDraft(db, {
			draftId: draft.id,
			userId,
		});
		expect(discarded).toBe(true);

		const [questionRow] = await db
			.select()
			.from(schema.questions)
			.where(eq(schema.questions.id, questionId));
		expect(questionRow?.question).toBe(original.question);

		const [draftRow] = await db
			.select()
			.from(schema.questionImprovementDrafts)
			.where(eq(schema.questionImprovementDrafts.id, draft.id));
		expect(draftRow?.status).toBe("discarded");
	});
});
