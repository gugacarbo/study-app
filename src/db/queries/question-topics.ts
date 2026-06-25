import type { AppDatabase } from "@/db/client";
import { createId } from "@/db/queries/helpers";
import * as schema from "@/db/schema";

export type QuestionTopicRecord = {
	id: string;
	name: string;
	normalizedName: string;
	createdAt: string | null;
};

export type SimilarityLabel =
	| "exact"
	| "normalized_exact"
	| "prefix"
	| "partial";

export type SimilarQuestionTopic = QuestionTopicRecord & {
	similarityLabel: SimilarityLabel;
};

export function normalizeQuestionTopicName(name: string): string {
	return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function mapTopicRow(
	row: typeof schema.questionTopics.$inferSelect,
): QuestionTopicRecord {
	return {
		id: row.id,
		name: row.name,
		normalizedName: row.normalizedName,
		createdAt: row.createdAt,
	};
}

function getSimilarityLabel(
	query: string,
	topic: QuestionTopicRecord,
): SimilarityLabel | null {
	const trimmedQuery = query.trim();
	const normalizedQuery = normalizeQuestionTopicName(query);

	if (!normalizedQuery) return null;
	if (topic.name === trimmedQuery) return "exact";
	if (topic.normalizedName === normalizedQuery) return "normalized_exact";
	if (
		topic.normalizedName.startsWith(normalizedQuery) ||
		normalizedQuery.startsWith(topic.normalizedName)
	) {
		return "prefix";
	}
	if (
		topic.normalizedName.includes(normalizedQuery) ||
		normalizedQuery.includes(topic.normalizedName)
	) {
		return "partial";
	}

	return null;
}

function sortBySimilarity(
	a: SimilarQuestionTopic,
	b: SimilarQuestionTopic,
): number {
	const rank: Record<SimilarityLabel, number> = {
		exact: 0,
		normalized_exact: 1,
		prefix: 2,
		partial: 3,
	};

	return (
		rank[a.similarityLabel] - rank[b.similarityLabel] ||
		a.name.localeCompare(b.name)
	);
}

export async function createQuestionTopic(
	db: AppDatabase,
	name: string,
): Promise<{ topic: QuestionTopicRecord; created: boolean }> {
	const normalizedName = normalizeQuestionTopicName(name);
	if (!normalizedName) {
		throw new Error("invalid_topic_name");
	}

	const existing = await db.query.questionTopics.findFirst({
		where: (topics, { eq: equal }) =>
			equal(topics.normalizedName, normalizedName),
	});
	if (existing) {
		return {
			topic: mapTopicRow(existing),
			created: false,
		};
	}

	const id = createId();
	await db.insert(schema.questionTopics).values({
		id,
		name: name.trim(),
		normalizedName,
	});

	const inserted = await db.query.questionTopics.findFirst({
		where: (topics, { eq: equal }) => equal(topics.id, id),
	});
	if (!inserted) {
		throw new Error("failed_to_create_topic");
	}

	return {
		topic: mapTopicRow(inserted),
		created: true,
	};
}

export async function searchSimilarQuestionTopics(
	db: AppDatabase,
	input: { query: string; limit?: number },
): Promise<SimilarQuestionTopic[]> {
	const normalizedQuery = normalizeQuestionTopicName(input.query);
	if (!normalizedQuery) return [];

	const rows = await db.select().from(schema.questionTopics);
	const candidates = rows
		.map(mapTopicRow)
		.map((topic) => {
			const similarityLabel = getSimilarityLabel(input.query, topic);
			return similarityLabel ? { ...topic, similarityLabel } : null;
		})
		.filter((topic): topic is SimilarQuestionTopic => topic !== null)
		.sort(sortBySimilarity);

	return candidates.slice(0, Math.min(input.limit ?? 5, 10));
}

export async function getQuestionTopicById(
	db: AppDatabase,
	topicId: string,
): Promise<QuestionTopicRecord | null> {
	const row = await db.query.questionTopics.findFirst({
		where: (topics, { eq: equal }) => equal(topics.id, topicId),
	});

	return row ? mapTopicRow(row) : null;
}

export async function getOrCreateQuestionTopicFromName(
	db: AppDatabase,
	name: string | null | undefined,
): Promise<QuestionTopicRecord | null> {
	if (!name || !name.trim()) return null;
	const { topic } = await createQuestionTopic(db, name);
	return topic;
}
