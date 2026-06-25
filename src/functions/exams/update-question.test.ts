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
import {
	updateQuestion,
	updateQuestionHandler,
	updateQuestionSchema,
} from "@/functions/exams/update-question";

describe("updateQuestionHandler", () => {
	beforeEach(() => {
		resetJobTestDb();
		vi.restoreAllMocks();
	});

	it("returns 404 when question belongs to another user", async () => {
		await seedUser(testDb, testUserId);
		await seedUser(testDb, otherUserId);

		const examId = createId();
		await createExam(testDb, {
			id: examId,
			userId: otherUserId,
			name: "Prova alheia",
		});

		const questionId = createId();
		await insertQuestion(testDb, {
			id: questionId,
			examId,
			question: "Original?",
			options: JSON.stringify([{ key: "A", text: "Old" }]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
		});

		await expect(
			updateQuestionHandler(
				{
					examId,
					questionId,
					question: "Updated?",
					options: [{ key: "A", text: "New" }],
					answers: ["A"],
					scoringMode: "exact",
				},
				new Headers(),
			),
		).rejects.toMatchObject({ status: 404 });
	});

	it("updates and returns the question for the owner", async () => {
		await seedUser(testDb, testUserId);

		const examId = createId();
		await createExam(testDb, {
			id: examId,
			userId: testUserId,
			name: "Minha prova",
		});
		const oldTopicId = createId();
		const newTopicId = createId();
		const sqlite = (
			testDb as unknown as {
				session: { client: { exec: (sql: string) => void } };
			}
		).session.client;
		sqlite.exec(
			`INSERT INTO question_topics (id, name, normalized_name) VALUES ('${oldTopicId}', 'Old', 'old');`,
		);
		sqlite.exec(
			`INSERT INTO question_topics (id, name, normalized_name) VALUES ('${newTopicId}', 'New', 'new');`,
		);

		const questionId = createId();
		await insertQuestion(testDb, {
			id: questionId,
			examId,
			question: "Original?",
			options: JSON.stringify([
				{ key: "A", text: "Old A" },
				{ key: "B", text: "Old B" },
			]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
			topicId: oldTopicId,
			explanation: "Old explanation",
			deepExplanation: "Old deep",
		} as never);

		const result = await updateQuestionHandler(
			{
				examId,
				questionId,
				question: "Updated?",
				options: [
					{ key: "A", text: "New A" },
					{ key: "B", text: "New B" },
					{ key: "C", text: "New C" },
				],
				answers: ["B", "C"],
				scoringMode: "partial",
				topicId: newTopicId,
				explanation: "New explanation",
				deepExplanation: "New deep",
			} as never,
			new Headers(),
		);

		expect(result).toEqual({
			id: questionId,
			question: "Updated?",
			options: [
				{ key: "A", text: "New A" },
				{ key: "B", text: "New B" },
				{ key: "C", text: "New C" },
			],
			answers: ["B", "C"],
			topicId: newTopicId,
			scoringMode: "partial",
			topic: "New",
			explanation: "New explanation",
			deepExplanation: "New deep",
		});
	});

	it("rejects invalid payload via server function", async () => {
		await seedUser(testDb, testUserId);

		const examId = createId();
		await createExam(testDb, {
			id: examId,
			userId: testUserId,
			name: "Minha prova",
		});

		const questionId = createId();
		await insertQuestion(testDb, {
			id: questionId,
			examId,
			question: "Qual?",
			options: JSON.stringify([{ key: "A", text: "A" }]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
		});

		await expect(
			updateQuestion({
				data: {
					examId,
					questionId,
					question: "",
					options: [{ key: "A", text: "A" }],
					answers: ["A"],
					scoringMode: "exact",
				},
			}),
		).rejects.toBeInstanceOf(Error);
	});
});

describe("updateQuestionSchema", () => {
	it("requires at least 2 options", () => {
		const result = updateQuestionSchema.safeParse({
			examId: createId(),
			questionId: createId(),
			question: "Qual?",
			options: [{ key: "A", text: "A" }],
			answers: ["A"],
			scoringMode: "exact",
		});

		expect(result.success).toBe(false);
	});

	it("requires answers to match existing option keys", () => {
		const result = updateQuestionSchema.safeParse({
			examId: createId(),
			questionId: createId(),
			question: "Qual?",
			options: [
				{ key: "A", text: "A" },
				{ key: "B", text: "B" },
			],
			answers: ["C"],
			scoringMode: "exact",
		});

		expect(result.success).toBe(false);
	});

	it("requires exactly one answer for exact scoring mode", () => {
		const result = updateQuestionSchema.safeParse({
			examId: createId(),
			questionId: createId(),
			question: "Qual?",
			options: [
				{ key: "A", text: "A" },
				{ key: "B", text: "B" },
			],
			answers: ["A", "B"],
			scoringMode: "exact",
		});

		expect(result.success).toBe(false);
	});

	it("allows multiple answers for partial scoring mode", () => {
		const result = updateQuestionSchema.safeParse({
			examId: createId(),
			questionId: createId(),
			question: "Quais?",
			options: [
				{ key: "A", text: "A" },
				{ key: "B", text: "B" },
				{ key: "C", text: "C" },
			],
			answers: ["A", "C"],
			scoringMode: "partial",
		});

		expect(result.success).toBe(true);
	});
});
