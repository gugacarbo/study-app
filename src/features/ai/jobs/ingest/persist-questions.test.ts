import { describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "@/db/client";
import { INGEST_DATA_PART } from "@/features/ai/jobs/ingest/ingest-events";
import {
	persistQuestions,
	type QuestionInsert,
} from "@/features/ai/jobs/ingest/persist-questions";
import { MAX_QUESTIONS } from "@/lib/ingest-limits";
import { INGEST_WARNING } from "@/lib/job-kinds";

const examId = "00000000-0000-4000-8000-000000000001";

function makeQuestion(index: number) {
	return {
		question: `Questão ${index}?`,
		options: [
			{ key: "A", text: "Opção A" },
			{ key: "B", text: "Opção B" },
		],
		answers: ["A"],
		topic: "Tópico",
		topicId: `topic-${index}`,
	};
}

function createDeps(overrides?: {
	existsNormalizedQuestion?: (
		examId: string,
		normalized: string,
	) => Promise<boolean>;
}) {
	const batchInsertQuestions = vi.fn(
		async (_questions: QuestionInsert[]) => undefined,
	);
	const existsNormalizedQuestion =
		overrides?.existsNormalizedQuestion ?? vi.fn(async () => false);
	const onSkippedDuplicate = vi.fn(async () => undefined);

	return {
		deps: {
			existsNormalizedQuestion,
			batchInsertQuestions,
			onSkippedDuplicate,
		},
		batchInsertQuestions,
		onSkippedDuplicate,
	};
}

describe("persistQuestions", () => {
	it("deduplicates intra-file questions by normalized text", async () => {
		const { deps, batchInsertQuestions, onSkippedDuplicate } = createDeps();

		const result = await persistQuestions({
			db: {} as AppDatabase,
			examId,
			questions: [
				makeQuestion(1),
				{ ...makeQuestion(1), topic: "Outro tópico" },
				makeQuestion(2),
			],
			deps,
		});

		expect(result.persistedCount).toBe(2);
		expect(result.skippedDuplicateCount).toBe(1);
		expect(batchInsertQuestions).toHaveBeenCalledOnce();
		const inserted = batchInsertQuestions.mock.calls.at(0)?.[0];
		expect(inserted).toHaveLength(2);
		expect(inserted?.[0]).toMatchObject({ topicId: "topic-1" });
		expect(onSkippedDuplicate).toHaveBeenCalledOnce();
	});

	it(`caps persistence at ${MAX_QUESTIONS} and counts overflow as invalid`, async () => {
		const { deps } = createDeps();
		const questions = Array.from({ length: MAX_QUESTIONS + 5 }, (_, index) =>
			makeQuestion(index + 1),
		);

		const result = await persistQuestions({
			db: {} as AppDatabase,
			examId,
			questions,
			deps,
		});

		expect(result.persistedCount).toBe(MAX_QUESTIONS);
		expect(result.invalidCount).toBe(5);
		expect(result.warning).toBe(INGEST_WARNING.PARTIAL_EXTRACTION);
	});

	it("sets partial_extraction warning when some items are invalid", async () => {
		const { deps } = createDeps();

		const result = await persistQuestions({
			db: {} as AppDatabase,
			examId,
			questions: [
				makeQuestion(1),
				{
					question: "",
					options: [{ key: "A", text: "A" }],
					answers: ["A"],
					topic: "Inválida",
				},
			],
			deps,
		});

		expect(result.persistedCount).toBe(1);
		expect(result.invalidCount).toBe(1);
		expect(result.warning).toBe(INGEST_WARNING.PARTIAL_EXTRACTION);
	});

	it("emits skipped duplicate data parts", async () => {
		const { deps, onSkippedDuplicate } = createDeps({
			existsNormalizedQuestion: async () => true,
		});

		await persistQuestions({
			db: {} as AppDatabase,
			examId,
			questions: [makeQuestion(1)],
			deps,
		});

		expect(onSkippedDuplicate).toHaveBeenCalledWith(
			expect.objectContaining({
				type: INGEST_DATA_PART.SKIPPED_DUPLICATE,
				data: expect.objectContaining({
					questionPreview: expect.stringMatching(/^Questão 1/),
				}),
			}),
		);
	});
});
