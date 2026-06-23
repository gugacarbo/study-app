import type { D1Database } from "@cloudflare/workers-types";
import { vi } from "vitest";
import type { AppDatabase } from "@/db/client";
import { createId } from "@/db/queries/helpers";
import * as schema from "@/db/schema";
import { createTestDb } from "@/db/test-db";

const hoisted = vi.hoisted(() => ({
	testUserId: "00000000-0000-4000-8000-000000000091",
	otherUserId: "00000000-0000-4000-8000-000000000092",
}));

export const testUserId = hoisted.testUserId;
export const otherUserId = hoisted.otherUserId;
export const testDb = createTestDb();

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
		user: { id: hoisted.testUserId },
		session: { id: "session-1" },
	})),
}));

export function resetQuizTestDb(db: AppDatabase) {
	const sqlite = (
		db as unknown as {
			session: { client: { exec: (sql: string) => void } };
		}
	).session.client;
	for (const table of [
		"attempt_answers",
		"attempts",
		"questions",
		"exams",
		"user_roles",
		"user",
	]) {
		sqlite.exec(`DELETE FROM ${table}`);
	}
}

export async function seedUser(db: AppDatabase, userId: string) {
	await db.insert(schema.user).values({
		id: userId,
		name: "User",
		email: `${userId}@aluno.ifsc.edu.br`,
		emailVerified: true,
	});
}

export async function seedExam(db: AppDatabase, userId: string, name = "Prova") {
	const examId = createId();
	await db.insert(schema.exams).values({
		id: examId,
		userId,
		name,
	});
	return examId;
}

export async function seedQuestion(
	db: AppDatabase,
	examId: string,
	input: {
		id: string;
		question: string;
		options: Array<{ key: string; text: string }>;
		answers: string[];
		topic?: string | null;
		scoringMode?: "exact" | "partial";
	},
) {
	await db.insert(schema.questions).values({
		id: input.id,
		examId,
		question: input.question,
		options: JSON.stringify(input.options),
		answers: JSON.stringify(input.answers),
		scoringMode: input.scoringMode ?? "exact",
		topic: input.topic ?? null,
	});
}

export async function seedAttempt(
	db: AppDatabase,
	input: {
		id: string;
		userId: string;
		examId: string;
		config: Record<string, unknown>;
		totalQuestions: number;
		status?: "in_progress" | "completed";
		startedAt?: string;
	},
) {
	await db.insert(schema.attempts).values({
		id: input.id,
		userId: input.userId,
		examId: input.examId,
		config: JSON.stringify(input.config),
		totalQuestions: input.totalQuestions,
		answeredQuestions: 0,
		correctAnswers: 0,
		status: input.status ?? "in_progress",
		startedAt: input.startedAt ?? new Date().toISOString(),
	});
}

export async function seedAnswer(
	db: AppDatabase,
	input: {
		attemptId: string;
		questionId: string;
		userAnswer: string[];
		correct: boolean;
		credit: number;
	},
) {
	await db.insert(schema.attemptAnswers).values({
		id: createId(),
		attemptId: input.attemptId,
		questionId: input.questionId,
		userAnswer: JSON.stringify(input.userAnswer),
		correct: input.correct,
		credit: input.credit,
	});
}
