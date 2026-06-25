import type { D1Database } from "@cloudflare/workers-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuestionTopic } from "@/db/queries/question-topics";
import { createTestDb } from "@/db/test-db";

const hoisted = vi.hoisted(() => ({
	testUserId: "00000000-0000-4000-8000-000000000091",
}));

const testDb = createTestDb();

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

import {
	createQuestionTopicHandler,
	createQuestionTopicSchema,
} from "./create-question-topic";
import { searchQuestionTopicsHandler } from "./search-question-topics";

function resetTestDb() {
	const sqlite = (
		testDb as unknown as {
			session: { client: { exec: (sql: string) => void } };
		}
	).session.client;
	sqlite.exec("DELETE FROM question_topics");
}

describe("question topic server functions", () => {
	beforeEach(() => {
		resetTestDb();
		vi.clearAllMocks();
	});

	it("creates a new topic and reuses it on normalized duplicates", async () => {
		const first = await createQuestionTopicHandler(
			{ name: "Geometria Analitica" },
			new Headers(),
		);
		const second = await createQuestionTopicHandler(
			{ name: "  geometria   analitica  " },
			new Headers(),
		);

		expect(first).toEqual({
			ok: true,
			topic: {
				topicId: expect.any(String),
				name: "Geometria Analitica",
				normalizedName: "geometria analitica",
			},
			created: true,
		});
		expect(second).toEqual({
			ok: true,
			topic: {
				topicId: first.topic.topicId,
				name: "Geometria Analitica",
				normalizedName: "geometria analitica",
			},
			created: false,
		});
	});

	it("searches similar topics and returns ordered candidates", async () => {
		const exact = await createQuestionTopic(testDb, "Geometria");
		await createQuestionTopic(testDb, "Geometria espacial");
		await createQuestionTopic(testDb, "Historia");

		const results = await searchQuestionTopicsHandler(
			{ query: "Geometria", limit: 5 },
			new Headers(),
		);

		expect(results).toEqual([
			{
				topicId: exact.topic.id,
				name: "Geometria",
				normalizedName: "geometria",
				similarityLabel: "exact",
			},
			{
				topicId: expect.any(String),
				name: "Geometria espacial",
				normalizedName: "geometria espacial",
				similarityLabel: "prefix",
			},
		]);
	});
});

describe("createQuestionTopicSchema", () => {
	it("rejects empty names", () => {
		const result = createQuestionTopicSchema.safeParse({ name: "   " });

		expect(result.success).toBe(false);
	});
});
