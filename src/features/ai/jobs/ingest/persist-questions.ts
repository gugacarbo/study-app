import type { AppDatabase } from "@/db/client";
import { createId } from "@/db/queries/helpers";
import {
	deriveScoringMode,
	type ExtractedQuestion,
	parseExtractedQuestion,
} from "@/features/ai/jobs/ingest/extracted-question";
import { buildIngestSkippedDuplicatePart } from "@/features/ai/jobs/ingest/ingest-events";
import { normalizeQuestionText } from "@/features/ai/jobs/ingest/normalize-question";
import { MAX_QUESTIONS } from "@/lib/ingest-limits";
import { INGEST_WARNING, type IngestWarning } from "@/lib/job-kinds";

export type QuestionInsert = {
	id: string;
	examId: string;
	question: string;
	options: string;
	answers: string;
	scoringMode: "exact" | "partial";
	topic: string;
};

export type PersistQuestionsDeps = {
	existsNormalizedQuestion: (
		examId: string,
		normalizedText: string,
	) => Promise<boolean>;
	batchInsertQuestions: (questions: QuestionInsert[]) => Promise<void>;
	onSkippedDuplicate?: (
		part: ReturnType<typeof buildIngestSkippedDuplicatePart>,
	) => Promise<void>;
};

export type PersistQuestionsInput = {
	db: AppDatabase;
	examId: string;
	questions: unknown[];
	deps: PersistQuestionsDeps;
};

export type PersistQuestionsResult = {
	extractedCount: number;
	persistedCount: number;
	skippedDuplicateCount: number;
	invalidCount: number;
	warning?: IngestWarning;
};

export async function persistQuestions(
	input: PersistQuestionsInput,
): Promise<PersistQuestionsResult> {
	const extractedCount = input.questions.length;
	const seenNormalized = new Set<string>();
	const toInsert: QuestionInsert[] = [];
	let skippedDuplicateCount = 0;
	let invalidCount = 0;

	for (const raw of input.questions) {
		const parsed = parseExtractedQuestion(raw);
		if (!parsed.ok) {
			invalidCount += 1;
			continue;
		}

		if (toInsert.length >= MAX_QUESTIONS) {
			invalidCount += 1;
			continue;
		}

		const question = parsed.data;
		const normalized = normalizeQuestionText(question.question);

		if (seenNormalized.has(normalized)) {
			skippedDuplicateCount += 1;
			await input.deps.onSkippedDuplicate?.(
				buildIngestSkippedDuplicatePart(question.question),
			);
			continue;
		}

		if (await input.deps.existsNormalizedQuestion(input.examId, normalized)) {
			skippedDuplicateCount += 1;
			await input.deps.onSkippedDuplicate?.(
				buildIngestSkippedDuplicatePart(question.question),
			);
			continue;
		}

		seenNormalized.add(normalized);
		toInsert.push(toQuestionInsert(input.examId, question));
	}

	if (toInsert.length > 0) {
		await input.deps.batchInsertQuestions(toInsert);
	}

	const persistedCount = toInsert.length;
	const warning =
		invalidCount > 0 ? INGEST_WARNING.PARTIAL_EXTRACTION : undefined;

	return {
		extractedCount,
		persistedCount,
		skippedDuplicateCount,
		invalidCount,
		warning,
	};
}

function toQuestionInsert(
	examId: string,
	question: ExtractedQuestion,
): QuestionInsert {
	return {
		id: createId(),
		examId,
		question: question.question,
		options: JSON.stringify(question.options),
		answers: JSON.stringify(question.answers.map((answer) => answer.trim())),
		scoringMode: deriveScoringMode(question.answers),
		topic: question.topic,
	};
}
