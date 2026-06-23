import { describe, expect, it } from "vitest";
import { createExam } from "@/db/queries/exams";
import { createId } from "@/db/queries/helpers";
import { insertQuestion } from "@/db/queries/questions";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import {
	completeAttempt,
	createAttempt,
	findActiveAttemptByExamId,
	findAttemptById,
	getAttemptById,
	getQuestionsForAttempt,
	listDistinctTopicsByExamId,
	parseConfig,
	recordAttemptAnswer,
	updateAttemptCounters,
} from "./attempts";

async function seedUser(db: ReturnType<typeof createTestDb>, userId: string) {
	await db.insert(schema.user).values({
		id: userId,
		name: "User",
		email: `${userId}@aluno.ifsc.edu.br`,
		emailVerified: true,
	});
}

describe("createAttempt", () => {
	it("inserts an in_progress attempt with config JSON", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);
		const examId = createId();
		await createExam(db, { id: examId, userId, name: "Prova" });

		const attempt = await createAttempt(db, {
			id: createId(),
			userId,
			examId,
			config: {
				order: "random",
				quantity: 5,
				topicFilter: "T1",
				revealMode: "during",
			},
			totalQuestions: 5,
		});

		expect(attempt.status).toBe("in_progress");
		expect(attempt.totalQuestions).toBe(5);
		expect(parseConfig(attempt.config)).toEqual({
			order: "random",
			quantity: 5,
			topicFilter: "T1",
			revealMode: "during",
		});
	});
});

describe("findAttemptById / getAttemptById", () => {
	it("finds attempt without user filter", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);
		const examId = createId();
		await createExam(db, { id: examId, userId, name: "Prova" });
		const attemptId = createId();
		await createAttempt(db, {
			id: attemptId,
			userId,
			examId,
			config: { order: "original", quantity: 0, topicFilter: null, revealMode: "after" },
			totalQuestions: 1,
		});

		const found = await findAttemptById(db, attemptId);
		expect(found?.id).toBe(attemptId);
		expect(found?.userId).toBe(userId);
	});

	it("filters by user_id", async () => {
		const db = createTestDb();
		const userId = createId();
		const otherUserId = createId();
		await seedUser(db, userId);
		await seedUser(db, otherUserId);
		const examId = createId();
		await createExam(db, { id: examId, userId: otherUserId, name: "Prova" });
		const attemptId = createId();
		await createAttempt(db, {
			id: attemptId,
			userId: otherUserId,
			examId,
			config: { order: "original", quantity: 0, topicFilter: null, revealMode: "after" },
			totalQuestions: 1,
		});

		expect(await getAttemptById(db, attemptId, userId)).toBeNull();
		expect(await getAttemptById(db, attemptId, otherUserId)).not.toBeNull();
	});
});

describe("recordAttemptAnswer and updateAttemptCounters", () => {
	it("upserts answer and recalculates counters", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);
		const examId = createId();
		await createExam(db, { id: examId, userId, name: "Prova" });
		const questionId = createId();
		await insertQuestion(db, {
			id: questionId,
			examId,
			question: "Q1",
			options: JSON.stringify([{ key: "A", text: "Yes" }]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
		});
		const attemptId = createId();
		await createAttempt(db, {
			id: attemptId,
			userId,
			examId,
			config: { order: "original", quantity: 0, topicFilter: null, revealMode: "after" },
			totalQuestions: 1,
		});

		await recordAttemptAnswer(db, {
			attemptId,
			questionId,
			userAnswer: JSON.stringify(["A"]),
			correct: true,
			credit: 1,
		});
		await updateAttemptCounters(db, attemptId);

		const attempt = await findAttemptById(db, attemptId);
		expect(attempt?.answeredQuestions).toBe(1);
		expect(attempt?.correctAnswers).toBe(1);
	});
});

describe("completeAttempt", () => {
	it("marks attempt as completed", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);
		const examId = createId();
		await createExam(db, { id: examId, userId, name: "Prova" });
		const attemptId = createId();
		await createAttempt(db, {
			id: attemptId,
			userId,
			examId,
			config: { order: "original", quantity: 0, topicFilter: null, revealMode: "after" },
			totalQuestions: 1,
		});

		const completed = await completeAttempt(db, attemptId);
		expect(completed.status).toBe("completed");
		expect(completed.completedAt).toBeTruthy();
	});
});

describe("findActiveAttemptByExamId", () => {
	it("returns the latest in_progress attempt for user/exam", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);
		const examId = createId();
		await createExam(db, { id: examId, userId, name: "Prova" });

		const olderId = createId();
		const newerId = createId();
		await db.insert(schema.attempts).values({
			id: olderId,
			userId,
			examId,
			config: JSON.stringify({
				order: "original",
				quantity: 0,
				topicFilter: null,
				revealMode: "after",
			}),
			totalQuestions: 1,
			startedAt: "2026-01-01T10:00:00.000Z",
		});
		await db.insert(schema.attempts).values({
			id: newerId,
			userId,
			examId,
			config: JSON.stringify({
				order: "original",
				quantity: 0,
				topicFilter: null,
				revealMode: "after",
			}),
			totalQuestions: 1,
			startedAt: "2026-06-01T10:00:00.000Z",
		});

		const active = await findActiveAttemptByExamId(db, userId, examId);
		expect(active?.id).toBe(newerId);
	});
});

describe("listDistinctTopicsByExamId", () => {
	it("returns sorted non-empty topics", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);
		const examId = createId();
		await createExam(db, { id: examId, userId, name: "Prova" });
		await insertQuestion(db, {
			id: createId(),
			examId,
			question: "Q1",
			options: JSON.stringify([{ key: "A", text: "A" }]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
			topic: "B",
		});
		await insertQuestion(db, {
			id: createId(),
			examId,
			question: "Q2",
			options: JSON.stringify([{ key: "A", text: "A" }]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
			topic: "A",
		});
		await insertQuestion(db, {
			id: createId(),
			examId,
			question: "Q3",
			options: JSON.stringify([{ key: "A", text: "A" }]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
			topic: null,
		});

		const topics = await listDistinctTopicsByExamId(db, examId);
		expect(topics).toEqual(["A", "B"]);
	});
});

describe("getQuestionsForAttempt", () => {
	it("filters by topic and limits quantity", async () => {
		const db = createTestDb();
		const userId = createId();
		await seedUser(db, userId);
		const examId = createId();
		await createExam(db, { id: examId, userId, name: "Prova" });

		for (let i = 0; i < 3; i++) {
			await insertQuestion(db, {
				id: createId(),
				examId,
				question: `T1 Q${i}`,
				options: JSON.stringify([{ key: "A", text: "A" }]),
				answers: JSON.stringify(["A"]),
				scoringMode: "exact",
				topic: "T1",
			});
		}
		await insertQuestion(db, {
			id: createId(),
			examId,
			question: "T2 Q",
			options: JSON.stringify([{ key: "A", text: "A" }]),
			answers: JSON.stringify(["A"]),
			scoringMode: "exact",
			topic: "T2",
		});

		const rows = await getQuestionsForAttempt(db, examId, {
			quantity: 2,
			topicFilter: "T1",
			order: "original",
		});
		expect(rows).toHaveLength(2);
		expect(rows.every((r) => r.topic === "T1")).toBe(true);
	});
});
