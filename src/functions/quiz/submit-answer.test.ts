import type { D1Database } from "@cloudflare/workers-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createId } from "@/db/queries/helpers";
import {
	otherUserId,
	resetQuizTestDb,
	seedAnswer,
	seedAttempt,
	seedExam,
	seedQuestion,
	seedUser,
	testDb,
	testUserId,
} from "./quiz-test-setup";
import { submitAnswerHandler } from "./submit-answer";

vi.mock("@/functions/db", () => ({
	requireDB: vi.fn(async () => ({}) as D1Database),
}));

vi.mock("@/db/client", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/db/client")>();
	return {
		...original,
		createDb: vi.fn(() => testDb),
	};
});

vi.mock("@/lib/rbac", () => ({
	requireSession: vi.fn(async () => ({
		user: { id: testUserId },
		session: { id: "session-1" },
	})),
}));

describe("submitAnswerHandler", () => {
	beforeEach(() => {
		resetQuizTestDb(testDb);
	});

	it("records a correct answer and updates counters", async () => {
		await seedUser(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const q1 = createId();
		await seedQuestion(testDb, examId, {
			id: q1,
			question: "Q1",
			options: [
				{ key: "A", text: "A" },
				{ key: "B", text: "B" },
			],
			answers: ["A"],
		});
		const attemptId = createId();
		await seedAttempt(testDb, {
			id: attemptId,
			userId: testUserId,
			examId,
			config: { order: "original", quantity: 1, topicFilter: null, revealMode: "after" },
			totalQuestions: 1,
		});

		const result = await submitAnswerHandler(
			{ attemptId, questionId: q1, selectedOptions: ["A"] },
			new Headers(),
		);

		expect(result.correct).toBe(true);
		expect(result.credit).toBe(1);
		expect(result.selectedOptionIds).toEqual(["A"]);
	});

	it("returns 404 for attempt of another user", async () => {
		await seedUser(testDb, testUserId);
		await seedUser(testDb, otherUserId);
		const examId = await seedExam(testDb, otherUserId);
		const q1 = createId();
		await seedQuestion(testDb, examId, {
			id: q1,
			question: "Q1",
			options: [{ key: "A", text: "A" }],
			answers: ["A"],
		});
		const attemptId = createId();
		await seedAttempt(testDb, {
			id: attemptId,
			userId: otherUserId,
			examId,
			config: { order: "original", quantity: 1, topicFilter: null, revealMode: "after" },
			totalQuestions: 1,
		});

		await expect(
			submitAnswerHandler(
				{ attemptId, questionId: q1, selectedOptions: ["A"] },
				new Headers(),
			),
		).rejects.toMatchObject({ status: 404 });
	});

	it("returns 409 for a completed attempt", async () => {
		await seedUser(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const q1 = createId();
		await seedQuestion(testDb, examId, {
			id: q1,
			question: "Q1",
			options: [{ key: "A", text: "A" }],
			answers: ["A"],
		});
		const attemptId = createId();
		await seedAttempt(testDb, {
			id: attemptId,
			userId: testUserId,
			examId,
			config: { order: "original", quantity: 1, topicFilter: null, revealMode: "after" },
			totalQuestions: 1,
			status: "completed",
		});

		await expect(
			submitAnswerHandler(
				{ attemptId, questionId: q1, selectedOptions: ["A"] },
				new Headers(),
			),
		).rejects.toMatchObject({ status: 409 });
	});

	it("returns 422 when question does not belong to the attempt exam", async () => {
		await seedUser(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const otherExamId = await seedExam(testDb, testUserId);
		const q1 = createId();
		await seedQuestion(testDb, otherExamId, {
			id: q1,
			question: "Q1",
			options: [{ key: "A", text: "A" }],
			answers: ["A"],
		});
		const attemptId = createId();
		await seedAttempt(testDb, {
			id: attemptId,
			userId: testUserId,
			examId,
			config: { order: "original", quantity: 1, topicFilter: null, revealMode: "after" },
			totalQuestions: 1,
		});

		await expect(
			submitAnswerHandler(
				{ attemptId, questionId: q1, selectedOptions: ["A"] },
				new Headers(),
			),
		).rejects.toMatchObject({ status: 422 });
	});

	it("updates an existing answer", async () => {
		await seedUser(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const q1 = createId();
		await seedQuestion(testDb, examId, {
			id: q1,
			question: "Q1",
			options: [
				{ key: "A", text: "A" },
				{ key: "B", text: "B" },
			],
			answers: ["A", "B"],
			scoringMode: "partial",
		});
		const attemptId = createId();
		await seedAttempt(testDb, {
			id: attemptId,
			userId: testUserId,
			examId,
			config: { order: "original", quantity: 1, topicFilter: null, revealMode: "after" },
			totalQuestions: 1,
		});
		await seedAnswer(testDb, {
			attemptId,
			questionId: q1,
			userAnswer: ["A"],
			correct: false,
			credit: 0.5,
		});

		const result = await submitAnswerHandler(
			{ attemptId, questionId: q1, selectedOptions: ["A", "B"] },
			new Headers(),
		);

		expect(result.correct).toBe(true);
		expect(result.credit).toBe(1);
	});
});
