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

import { listExamTopicsHandler } from "./list-exam-topics";

describe("listExamTopicsHandler", () => {
	beforeEach(() => {
		resetQuizTestDb(testDb);
		vi.clearAllMocks();
	});

	it("returns 404 for exam of another user", async () => {
		await seedUser(testDb, testUserId);
		await seedUser(testDb, otherUserId);
		const examId = await seedExam(testDb, otherUserId);

		await expect(
			listExamTopicsHandler({ examId }, new Headers()),
		).rejects.toMatchObject({ status: 404 });
	});

	it("returns sorted non-empty topics for the user's exam", async () => {
		await seedUser(testDb, testUserId);
		const examId = await seedExam(testDb, testUserId);
		await seedQuestion(testDb, examId, {
			id: createId(),
			question: "Q1",
			options: [{ key: "A", text: "A" }],
			answers: ["A"],
			topic: "B",
		});
		await seedQuestion(testDb, examId, {
			id: createId(),
			question: "Q2",
			options: [{ key: "A", text: "A" }],
			answers: ["A"],
			topic: "A",
		});
		await seedQuestion(testDb, examId, {
			id: createId(),
			question: "Q3",
			options: [{ key: "A", text: "A" }],
			answers: ["A"],
			topic: null,
		});

		const topics = await listExamTopicsHandler({ examId }, new Headers());

		expect(topics).toEqual(["A", "B"]);
	});
});
