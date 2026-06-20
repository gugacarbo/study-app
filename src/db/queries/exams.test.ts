import { describe, expect, it } from "vitest";
import { createExam, listExamsByUserId } from "@/db/queries/exams";
import { createId } from "@/db/queries/helpers";
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
				question: "Q1",
				options: JSON.stringify([{ key: "A", text: "One" }]),
				answers: JSON.stringify(["A"]),
				scoringMode: "exact",
				topic: "t",
			},
			{
				id: createId(),
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
