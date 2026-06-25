import { describe, expect, it } from "vitest";
import { createTestDb } from "@/db/test-db";

describe("question_topics migration", () => {
	it("creates the global question_topics table with normalized_name uniqueness", async () => {
		const db = createTestDb();
		const sqlite = (
			db as unknown as {
				session: { client: { prepare: (sql: string) => { all: () => unknown[] } } };
			}
		).session.client;

		const tables = sqlite
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'question_topics'",
			)
			.all() as Array<{ name: string }>;

		expect(tables).toEqual([{ name: "question_topics" }]);

		const indexes = sqlite
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'uq_question_topics_normalized_name'",
			)
			.all() as Array<{ name: string }>;

		expect(indexes).toEqual([
			{ name: "uq_question_topics_normalized_name" },
		]);
	});
});
