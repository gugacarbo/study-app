import { describe, expect, it } from "vitest";
import { createTestDb } from "@/db/test-db";
import * as schema from "@/db/schema";
import { createExam, getExamById } from "@/db/queries/exams";
import { createId } from "@/db/queries/helpers";

describe("user scoping", () => {
	it("getExamById returns null when user does not own exam", async () => {
		const db = createTestDb();
		const userA = createId();
		const userB = createId();
		const examId = createId();

		await db.insert(schema.user).values([
			{
				id: userA,
				name: "A",
				email: "a@ifsc.edu.br",
				emailVerified: true,
			},
			{
				id: userB,
				name: "B",
				email: "b@ifsc.edu.br",
				emailVerified: true,
			},
		]);

		await createExam(db, { id: examId, userId: userA, name: "Prova A" });

		expect((await getExamById(db, examId, userA))?.id).toBe(examId);
		expect(await getExamById(db, examId, userB)).toBeNull();
	});
});
