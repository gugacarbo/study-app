import { count, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
	createExam,
	deleteExamById,
	getExamWithQuestions,
	listExamsByUserId,
} from "@/db/queries/exams";
import { createAttempt, recordAttemptAnswer } from "@/db/queries/attempts";
import { createId } from "@/db/queries/helpers";
import { insertFile } from "@/db/queries/files";
import { upsertPendingQuestionImprovementDraft } from "@/db/queries/question-improvement-drafts";
import { batchInsertQuestions } from "@/db/queries/questions";
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

describe("getExamWithQuestions", () => {
	it("returns null when exam belongs to another user", async () => {
		const db = createTestDb();
		const userId = createId();
		const otherUserId = createId();
		await seedUser(db, userId);
		await seedUser(db, otherUserId);

		const examId = createId();
		await createExam(db, { id: examId, userId: otherUserId, name: "Prova" });

		const result = await getExamWithQuestions(db, examId, userId);

		expect(result).toBeNull();
	});

	it("returns null when exam does not exist", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);

		const result = await getExamWithQuestions(db, createId(), userId);

		expect(result).toBeNull();
	});

	it("returns questions ordered by createdAt", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);

		const examId = createId();
		await createExam(db, { id: examId, userId, name: "Prova" });

		const firstId = createId();
		const secondId = createId();
		await db.insert(schema.questions).values([
			{
				id: firstId,
				examId,
				question: "Q1",
				options: JSON.stringify([{ key: "A", text: "One" }]),
				answers: JSON.stringify(["A"]),
				scoringMode: "exact",
				topic: "t1",
				createdAt: "2026-01-01T10:00:00.000Z",
			},
			{
				id: secondId,
				examId,
				question: "Q2",
				options: JSON.stringify([{ key: "A", text: "One" }]),
				answers: JSON.stringify(["A"]),
				scoringMode: "exact",
				topic: "t2",
				createdAt: "2026-06-01T10:00:00.000Z",
			},
		]);

		const result = await getExamWithQuestions(db, examId, userId);

		expect(result).toMatchObject({
			id: examId,
			name: "Prova",
		});
		expect(result?.questions.map((row) => row.id)).toEqual([
			firstId,
			secondId,
		]);
	});

	it("returns exam metadata with empty questions array", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);

		const examId = createId();
		await createExam(db, {
			id: examId,
			userId,
			name: "Prova vazia",
		});

		const result = await getExamWithQuestions(db, examId, userId);

		expect(result).toEqual({
			id: examId,
			name: "Prova vazia",
			createdAt: expect.any(String),
			questions: [],
		});
	});
});

describe("listExamsByUserId", () => {
	it("returns exams for the user ordered by newest first", async () => {
		const db = createTestDb();
		const userId = createId();
		const otherUserId = createId();
		await seedUser(db, userId);
		await seedUser(db, otherUserId);

		const olderExamId = createId();
		const newerExamId = createId();
		await db.insert(schema.exams).values([
			{
				id: olderExamId,
				userId,
				name: "Prova antiga",
				createdAt: "2026-01-01T10:00:00.000Z",
			},
			{
				id: newerExamId,
				userId,
				name: "Prova nova",
				createdAt: "2026-06-01T10:00:00.000Z",
			},
		]);
		await createExam(db, {
			id: createId(),
			userId: otherUserId,
			name: "Prova de outro usuário",
		});

		const rows = await listExamsByUserId(db, userId);

		expect(rows).toHaveLength(2);
		expect(rows.map((row) => row.name)).toEqual([
			"Prova nova",
			"Prova antiga",
		]);
	});

	it("includes question count per exam", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);

		const examId = createId();
		await createExam(db, { id: examId, userId, name: "Prova" });
		await batchInsertQuestions(db, examId, [
			{
				id: createId(),
				examId,
				question: "Q1",
				options: JSON.stringify([{ key: "A", text: "One" }]),
				answers: JSON.stringify(["A"]),
				scoringMode: "exact",
				topic: "t",
			},
			{
				id: createId(),
				examId,
				question: "Q2",
				options: JSON.stringify([{ key: "A", text: "One" }]),
				answers: JSON.stringify(["A"]),
				scoringMode: "exact",
				topic: "t",
			},
		]);

		const rows = await listExamsByUserId(db, userId);

		expect(rows).toEqual([
			expect.objectContaining({
				id: examId,
				name: "Prova",
				questionCount: 2,
			}),
		]);
	});
});

describe("deleteExamById", () => {
	it("returns false when exam belongs to another user", async () => {
		const db = createTestDb();
		const userId = createId();
		const otherUserId = createId();
		await seedUser(db, userId);
		await seedUser(db, otherUserId);

		const examId = createId();
		await createExam(db, { id: examId, userId: otherUserId, name: "Prova" });

		await expect(deleteExamById(db, examId, userId)).resolves.toBe(false);
		expect(await getExamWithQuestions(db, examId, otherUserId)).not.toBeNull();
	});

	it("deletes the exam and cascades dependent rows", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);

		const examId = createId();
		const questionId = createId();
		const attemptId = createId();
		await createExam(db, { id: examId, userId, name: "Prova" });
		await batchInsertQuestions(db, examId, [
			{
				id: questionId,
				examId,
				question: "Q1",
				options: JSON.stringify([{ key: "A", text: "One" }]),
				answers: JSON.stringify(["A"]),
				scoringMode: "exact",
				topic: "t",
			},
		]);
		await insertFile(db, {
			id: createId(),
			examId,
			name: "prova.md",
			r2Key: `users/${userId}/files/prova.md`,
		});
		await createAttempt(db, {
			id: attemptId,
			userId,
			examId,
			config: {
				order: "original",
				quantity: 0,
				topicFilter: null,
				revealMode: "after",
			},
			totalQuestions: 1,
		});
		await recordAttemptAnswer(db, {
			attemptId,
			questionId,
			userAnswer: JSON.stringify(["A"]),
			correct: true,
			credit: 1,
		});
		await upsertPendingQuestionImprovementDraft(db, {
			id: createId(),
			userId,
			examId,
			questionId,
			jobId: createId(),
			originalSnapshot: {
				question: "Q1",
				options: [{ key: "A", text: "One" }],
				answers: ["A"],
				topic: "t",
				scoringMode: "exact",
				explanation: null,
				deepExplanation: null,
			},
			improvedSnapshot: {
				question: "Q1 melhorada",
				options: [{ key: "A", text: "One" }],
				answers: ["A"],
				topic: "t",
				scoringMode: "exact",
				explanation: null,
				deepExplanation: null,
			},
			summary: null,
			metadata: null,
		});

		await expect(deleteExamById(db, examId, userId)).resolves.toBe(true);
		await expect(getExamWithQuestions(db, examId, userId)).resolves.toBeNull();

		const [questionCountRow] = await db
			.select({ count: count() })
			.from(schema.questions)
			.where(eq(schema.questions.examId, examId));
		const [fileCountRow] = await db
			.select({ count: count() })
			.from(schema.files)
			.where(eq(schema.files.examId, examId));
		const [attemptCountRow] = await db
			.select({ count: count() })
			.from(schema.attempts)
			.where(eq(schema.attempts.examId, examId));
		const [draftCountRow] = await db
			.select({ count: count() })
			.from(schema.questionImprovementDrafts)
			.where(eq(schema.questionImprovementDrafts.examId, examId));

		expect(questionCountRow?.count).toBe(0);
		expect(fileCountRow?.count).toBe(0);
		expect(attemptCountRow?.count).toBe(0);
		expect(draftCountRow?.count).toBe(0);
	});
});
