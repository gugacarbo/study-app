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
import { getActiveAttemptHandler } from "./get-active-attempt";

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

describe("getActiveAttemptHandler", () => {
	beforeEach(() => {
		resetQuizTestDb(testDb);
	});

	it("returns null when no active attempt exists", async () => {
		await seedUser(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		await seedQuestion(testDb, examId, {
			id: createId(),
			question: "Q1",
			options: [{ key: "A", text: "A" }],
			answers: ["A"],
		});

		const result = await getActiveAttemptHandler({ examId }, new Headers());

		expect(result).toBeNull();
	});

	it("returns active attempt with selected answers", async () => {
		await seedUser(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const q1 = createId();
		const q2 = createId();
		await seedQuestion(testDb, examId, {
			id: q1,
			question: "Q1",
			options: [
				{
					key: "A",
					text: "A",
					explanation: "A alternativa A cobre o caso base.",
				},
			],
			answers: ["A"],
		});
		await seedQuestion(testDb, examId, {
			id: q2,
			question: "Q2",
			options: [
				{ key: "A", text: "A", explanation: "A nao resolve o enunciado." },
				{ key: "B", text: "B", explanation: "B resolve corretamente." },
			],
			answers: ["B"],
		});

		const attemptId = createId();
		await seedAttempt(testDb, {
			id: attemptId,
			userId: testUserId,
			examId,
			config: {
				order: "original",
				quantity: 0,
				topicFilter: null,
				revealMode: "after",
			},
			totalQuestions: 2,
		});
		await seedAnswer(testDb, {
			attemptId,
			questionId: q2,
			userAnswer: ["B"],
			correct: true,
			credit: 1,
		});

		const result = await getActiveAttemptHandler({ examId }, new Headers());

		expect(result).not.toBeNull();
		expect(result?.attempt.id).toBe(attemptId);
		expect(result?.questions).toHaveLength(2);
		const answered = result?.questions.find((q) => q.id === q2);
		expect(answered?.selectedOptionIds).toEqual(["B"]);
		expect(answered?.options).toEqual([
			{ id: "A", text: "A", explanation: "A nao resolve o enunciado." },
			{ id: "B", text: "B", explanation: "B resolve corretamente." },
		]);
	});

	it("returns 404 for exam of another user", async () => {
		await seedUser(testDb, testUserId);
		await seedUser(testDb, otherUserId);
		const examId = await seedExam(testDb, otherUserId);

		await expect(
			getActiveAttemptHandler({ examId }, new Headers()),
		).rejects.toMatchObject({ status: 404 });
	});
});
