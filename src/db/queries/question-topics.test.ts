import { describe, expect, it } from "vitest";
import {
	createQuestionTopic,
	normalizeQuestionTopicName,
	searchSimilarQuestionTopics,
} from "@/db/queries/question-topics";
import { createTestDb } from "@/db/test-db";

describe("normalizeQuestionTopicName", () => {
	it("trims, collapses whitespace and lowercases", () => {
		expect(normalizeQuestionTopicName("  Matemática   Básica \n")).toBe(
			"matemática básica",
		);
	});
});

describe("createQuestionTopic", () => {
	it("deduplicates by normalized_name", async () => {
		const db = createTestDb();

		const first = await createQuestionTopic(db, "Matemática  Básica");
		const second = await createQuestionTopic(db, "  matemática básica ");

		expect(first.created).toBe(true);
		expect(second.created).toBe(false);
		expect(second.topic.id).toBe(first.topic.id);
		expect(second.topic.normalizedName).toBe("matemática básica");
	});
});

describe("searchSimilarQuestionTopics", () => {
	it("returns ordered textual matches with labels", async () => {
		const db = createTestDb();
		await createQuestionTopic(db, "Geografia");
		await createQuestionTopic(db, "Geografia do Brasil");
		await createQuestionTopic(db, "História");

		const result = await searchSimilarQuestionTopics(db, {
			query: "geografia",
			limit: 5,
		});

		expect(result.map((topic) => ({
			name: topic.name,
			similarityLabel: topic.similarityLabel,
		}))).toEqual([
			{ name: "Geografia", similarityLabel: "normalized_exact" },
			{ name: "Geografia do Brasil", similarityLabel: "prefix" },
		]);
	});

	it("returns an empty list when the query has no textual match", async () => {
		const db = createTestDb();
		await createQuestionTopic(db, "Química");

		const result = await searchSimilarQuestionTopics(db, {
			query: "Biologia",
		});

		expect(result).toEqual([]);
	});
});
