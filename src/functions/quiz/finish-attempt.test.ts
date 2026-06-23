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
import { finishAttemptHandler } from "./finish-attempt";

vi.mock("crypto", () => ({
	randomUUID: vi.fn(() => "00000000-0000-4000-8000-000000000099"),
}));

	describe("finishAttemptHandler", () => {
	beforeEach(() => {
		resetQuizTestDb(testDb);
	});

	it("finalizes an attempt and returns the result", async () => {
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
			answers: ["B"],
			scoringMode: "exact",
		});

		const attemptId = createId();
		await seedAttempt(testDb, {
			id: attemptId,
			userId: testUserId,
			examId,
			config: { order: "original", quantity: 0, topicFilter: null, revealMode: "after" },
			totalQuestions: 1,
		});
		await seedAnswer(testDb, {
			attemptId,
			questionId: q1,
			userAnswer: ["B"],
			correct: true,
			credit: 1,
		});

		const result = await finishAttemptHandler({ attemptId }, new Headers());

		expect(result.status).toBe("completed");
		expect(result.scorePercent).toBe(100);
		expect(result.questions).toHaveLength(1);
		expect(result.questions[0]?.credit).toBe(1);
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
		});

		await expect(
			finishAttemptHandler({ attemptId }, new Headers()),
		).rejects.toMatchObject({ status: 404 });
	});

	it("returns 409 when attempt is not in_progress", async () => {
		await seedUser(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const attemptId = createId();
		await seedAttempt(testDb, {
			id: attemptId,
			userId: testUserId,
			examId,
			config: { order: "original", quantity: 0, topicFilter: null, revealMode: "after" },
			totalQuestions: 1,
			status: "completed",
		});

		await expect(
			finishAttemptHandler({ attemptId }, new Headers()),
		).rejects.toMatchObject({ status: 409 });
	});
});
