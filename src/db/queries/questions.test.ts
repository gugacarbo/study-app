import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createExam } from "@/db/queries/exams";
import { createId } from "@/db/queries/helpers";
import { updateQuestionById } from "@/db/queries/questions";
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

describe("updateQuestionById", () => {
	it("updates the question when it belongs to the user's exam", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);

		const examId = createId();
		await createExam(db, { id: examId, userId, name: "Prova" });

		const questionId = createId();
		await db.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Original?",
			options: JSON.stringify([{ key: "A", text: "Old" }]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
			topic: "Old topic",
			explanation: "Old explanation",
			deepExplanation: "Old deep",
		});

		const updated = await updateQuestionById(db, {
			questionId,
			userId,
			question: "Updated?",
			options: JSON.stringify([
				{ key: "A", text: "New A" },
				{ key: "B", text: "New B" },
			]),
			answers: JSON.stringify(["B"]),
			scoringMode: "partial",
			topic: "New topic",
			explanation: "New explanation",
			deepExplanation: "New deep",
		});

		expect(updated).toBe(true);

		const rows = await db
			.select()
			.from(schema.questions)
			.where(eq(schema.questions.id, questionId));

		expect(rows[0]).toMatchObject({
			question: "Updated?",
			options: JSON.stringify([
				{ key: "A", text: "New A" },
				{ key: "B", text: "New B" },
			]),
			answers: JSON.stringify(["B"]),
			scoringMode: "partial",
			topic: "New topic",
			explanation: "New explanation",
			deepExplanation: "New deep",
		});
	});

	it("returns false when question belongs to another user's exam", async () => {
		const db = createTestDb();
		const userId = createId();
		const otherUserId = createId();
		await seedUser(db, userId);
		await seedUser(db, otherUserId);

		const examId = createId();
		await createExam(db, { id: examId, userId: otherUserId, name: "Prova" });

		const questionId = createId();
		await db.insert(schema.questions).values({
			id: questionId,
			examId,
			question: "Original?",
			options: JSON.stringify([{ key: "A", text: "Old" }]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
		});

		const updated = await updateQuestionById(db, {
			questionId,
			userId,
			question: "Updated?",
			options: JSON.stringify([{ key: "A", text: "New" }]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
		});

		expect(updated).toBe(false);
	});

	it("returns false when question does not exist", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);

		const updated = await updateQuestionById(db, {
			questionId: createId(),
			userId,
			question: "Updated?",
			options: JSON.stringify([{ key: "A", text: "New" }]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
		});

		expect(updated).toBe(false);
	});
});
