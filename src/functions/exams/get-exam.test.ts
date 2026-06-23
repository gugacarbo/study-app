import { beforeEach, describe, expect, it, vi } from "vitest";
import { createExam } from "@/db/queries/exams";
import { createId } from "@/db/queries/helpers";
import { insertQuestion } from "@/db/queries/questions";
import {
	otherUserId,
	resetJobTestDb,
	seedUser,
	testDb,
	testUserId,
} from "@/functions/jobs/job-test-setup";
import { getExamHandler } from "@/functions/exams/get-exam";

describe("getExamHandler", () => {
	beforeEach(() => {
		resetJobTestDb();
		vi.restoreAllMocks();
	});

	it("returns 404 when exam belongs to another user", async () => {
		await seedUser(testDb, testUserId);
		await seedUser(testDb, otherUserId);

		const examId = createId();
		await createExam(testDb, {
			id: examId,
			userId: otherUserId,
			name: "Prova alheia",
		});

		await expect(
			getExamHandler({ examId }, new Headers()),
		).rejects.toMatchObject({ status: 404 });
	});

	it("returns parsed exam detail for owned exam", async () => {
		await seedUser(testDb, testUserId);

		const examId = createId();
		await createExam(testDb, {
			id: examId,
			userId: testUserId,
			name: "Minha prova",
		});

		const validQuestionId = createId();
		const invalidQuestionId = createId();
		await insertQuestion(testDb, {
			id: validQuestionId,
			examId,
			question: "Qual a capital?",
			options: JSON.stringify([
				{ key: "A", text: "Brasília" },
				{ key: "B", text: "São Paulo" },
			]),
			answers: JSON.stringify(["A", "B"]),
			scoringMode: "partial",
			topic: "Geografia",
		});
		await insertQuestion(testDb, {
			id: invalidQuestionId,
			examId,
			question: "Corrupta",
			options: "not-json",
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
			topic: null,
		});

		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		const result = await getExamHandler({ examId }, new Headers());

		expect(result).toEqual({
			id: examId,
			name: "Minha prova",
			createdAt: expect.any(String),
			questionCount: 1,
			questions: [
				{
					id: validQuestionId,
					question: "Qual a capital?",
					options: [
						{ key: "A", text: "Brasília" },
						{ key: "B", text: "São Paulo" },
					],
					answers: ["A", "B"],
					scoringMode: "partial",
					topic: "Geografia",
					explanation: null,
					deepExplanation: null,
				},
			],
		});
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining(invalidQuestionId),
		);
	});
});
