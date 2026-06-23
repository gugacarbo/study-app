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

import { getAttemptResultHandler } from "./get-attempt-result";

describe("getAttemptResultHandler", () => {
	beforeEach(() => {
		resetQuizTestDb(testDb);
		vi.clearAllMocks();
	});

	it("returns the completed attempt result", async () => {
		await seedUser(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const q1 = createId();
		const q2 = createId();
		await seedQuestion(testDb, examId, {
			id: q1,
			question: "Q1",
			options: [{ key: "A", text: "A" }],
			answers: ["A"],
		});
		await seedQuestion(testDb, examId, {
			id: q2,
			question: "Q2",
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
			config: { order: "original", quantity: 0, topicFilter: null, revealMode: "after" },
			totalQuestions: 2,
			status: "completed",
		});
		await seedAnswer(testDb, {
			attemptId,
			questionId: q1,
			userAnswer: ["A"],
			correct: true,
			credit: 1,
		});
		await seedAnswer(testDb, {
			attemptId,
			questionId: q2,
			userAnswer: ["A"],
			correct: false,
			credit: 0.5,
		});

		const result = await getAttemptResultHandler(
			{ attemptId },
			new Headers(),
		);

		expect(result.scorePercent).toBe(75);
		expect(result.questions).toHaveLength(2);
	});

	it("returns 404 for attempt of another user", async () => {
		await seedUser(testDb, testUserId);
		await seedUser(testDb, otherUserId);
		const examId = await seedExam(testDb, otherUserId);
		const attemptId = createId();
		await seedAttempt(testDb, {
			id: attemptId,
			userId: otherUserId,
			examId,
			config: { order: "original", quantity: 0, topicFilter: null, revealMode: "after" },
			totalQuestions: 1,
			status: "completed",
		});

		await expect(
			getAttemptResultHandler({ attemptId }, new Headers()),
		).rejects.toMatchObject({ status: 404 });
	});

	it("returns 409 when attempt is still in_progress", async () => {
		await seedUser(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const attemptId = createId();
		await seedAttempt(testDb, {
			id: attemptId,
			userId: testUserId,
			examId,
			config: { order: "original", quantity: 0, topicFilter: null, revealMode: "after" },
			totalQuestions: 1,
			status: "in_progress",
		});

		await expect(
			getAttemptResultHandler({ attemptId }, new Headers()),
		).rejects.toMatchObject({ status: 409 });
	});
});
