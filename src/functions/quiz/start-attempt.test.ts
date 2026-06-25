import type { D1Database } from "@cloudflare/workers-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createId } from "@/db/queries/helpers";
import {
	otherUserId,
	resetQuizTestDb,
	seedExam,
	seedQuestion,
	seedUser,
	testDb,
	testUserId,
} from "./quiz-test-setup";
import { startAttemptHandler } from "./start-attempt";

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

vi.mock("crypto", () => ({
	randomUUID: vi.fn(() => "00000000-0000-4000-8000-000000000099"),
}));

describe("startAttemptHandler", () => {
	beforeEach(() => {
		resetQuizTestDb(testDb);
		vi.clearAllMocks();
	});

	it("returns 404 when exam does not belong to user", async () => {
		await seedUser(testDb, testUserId);
		await seedUser(testDb, otherUserId);
		const examId = await seedExam(testDb, otherUserId);

		await expect(
			startAttemptHandler({ examId }, new Headers()),
		).rejects.toMatchObject({ status: 404 });
	});

	it("creates an attempt with default config", async () => {
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
			options: [{ key: "A", text: "A" }],
			answers: ["A"],
		});

		const attempt = await startAttemptHandler({ examId }, new Headers());

		expect(attempt.examId).toBe(examId);
		expect(attempt.totalQuestions).toBe(2);
		expect(attempt.status).toBe("in_progress");
		expect(attempt.config.order).toBe("original");
		expect(attempt.config.revealMode).toBe("after");
		expect(attempt.config.seed).toEqual(expect.any(Number));
	});

	it("limits quantity to available questions", async () => {
		await seedUser(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		for (let i = 0; i < 5; i++) {
			await seedQuestion(testDb, examId, {
				id: createId(),
				question: `Q${i}`,
				options: [{ key: "A", text: "A" }],
				answers: ["A"],
			});
		}

		const attempt = await startAttemptHandler(
			{ examId, quantity: 10 },
			new Headers(),
		);

		expect(attempt.totalQuestions).toBe(5);
		expect(attempt.config.quantity).toBe(5);
	});

	it("returns existing active attempt instead of creating a new one", async () => {
		await seedUser(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		await seedQuestion(testDb, examId, {
			id: createId(),
			question: "Q1",
			options: [{ key: "A", text: "A" }],
			answers: ["A"],
		});

		const first = await startAttemptHandler({ examId }, new Headers());
		const second = await startAttemptHandler({ examId }, new Headers());

		expect(second.id).toBe(first.id);
	});

	it("rejects start when no questions match topic filter", async () => {
		await seedUser(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		const topicId = createId();
		const sqlite = (
			testDb as unknown as {
				session: { client: { exec: (sql: string) => void } };
			}
		).session.client;
		sqlite.exec(
			`INSERT INTO question_topics (id, name, normalized_name) VALUES ('${topicId}', 'T1', 't1');`,
		);
		await seedQuestion(testDb, examId, {
			id: createId(),
			question: "Q1",
			options: [{ key: "A", text: "A" }],
			answers: ["A"],
			topicId,
		} as never);

		await expect(
			startAttemptHandler(
				{ examId, topicFilter: createId() },
				new Headers(),
			),
		).rejects.toMatchObject({ status: 422 });
	});
});
