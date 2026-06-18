import { describe, expect, it } from "vitest";
import { createExam } from "@/db/queries/exams";
import { createId } from "@/db/queries/helpers";
import {
	batchInsertQuestions,
	existsNormalizedQuestion,
	insertQuestion,
	listQuestionsByExam,
	normalizeQuestionText,
} from "@/db/queries/questions";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";

async function seedExam(db: ReturnType<typeof createTestDb>, userId: string) {
	const examId = createId();
	await db.insert(schema.user).values({
		id: userId,
		name: "User",
		email: `${userId}@aluno.ifsc.edu.br`,
		emailVerified: true,
	});
	await createExam(db, { id: examId, userId, name: "Exam" });
	return examId;
}

function sampleQuestion(examId: string, text: string, id = createId()) {
	return {
		id,
		examId,
		question: text,
		options: JSON.stringify([
			{ key: "A", text: "One" },
			{ key: "B", text: "Two" },
		]),
		answers: JSON.stringify(["A"]),
		scoringMode: "exact" as const,
		topic: "topic",
	};
}

describe("questions queries", () => {
	it("normalizeQuestionText trims, collapses whitespace, lowercases", () => {
		expect(normalizeQuestionText("  Foo   BAR \n baz  ")).toBe("foo bar baz");
	});

	it("existsNormalizedQuestion detects stored duplicate by normalization", async () => {
		const db = createTestDb();
		const userId = createId();
		const examId = await seedExam(db, userId);
		const questionId = createId();

		await insertQuestion(
			db,
			sampleQuestion(examId, "  What is   TWO plus TWO?  ", questionId),
		);

		const normalized = normalizeQuestionText("what is two plus two?");
		expect(await existsNormalizedQuestion(db, examId, normalized)).toBe(true);
		expect(
			await existsNormalizedQuestion(db, examId, "unrelated question"),
		).toBe(false);
	});

	it("listQuestionsByExam returns questions for the exam only", async () => {
		const db = createTestDb();
		const userId = createId();
		const examId = await seedExam(db, userId);
		const otherExamId = createId();
		await createExam(db, { id: otherExamId, userId, name: "Other" });

		const q1 = createId();
		const q2 = createId();
		await insertQuestion(db, sampleQuestion(examId, "Q1", q1));
		await insertQuestion(db, sampleQuestion(otherExamId, "Other Q", q2));

		const rows = await listQuestionsByExam(db, examId);
		expect(rows.map((row) => row.id)).toEqual([q1]);
	});

	it("batchInsertQuestions skips intra-batch and DB duplicates", async () => {
		const db = createTestDb();
		const userId = createId();
		const examId = await seedExam(db, userId);

		await insertQuestion(db, sampleQuestion(examId, "Existing question"));

		const result = await batchInsertQuestions(db, examId, [
			sampleQuestion(examId, "New question"),
			sampleQuestion(examId, "  NEW   question  "),
			sampleQuestion(examId, "Existing question"),
			sampleQuestion(examId, "Another new one"),
		]);

		expect(result).toEqual({
			insertedCount: 2,
			skippedDuplicateCount: 2,
		});

		const rows = await listQuestionsByExam(db, examId);
		expect(rows).toHaveLength(3);
	});
});
