import type {
	ExamIngestResponse,
	ProviderConfig,
	Question,
} from "@/lib/validation";
import { mapWithConcurrency } from "./execute-helpers";
import { deriveTopics } from "./prompt";
import { reviewSingleQuestion } from "./review-question";
import type { IngestReviewResult, ReviewExtractionOptions } from "./types";

export const REVIEW_CONCURRENCY = 10;
export const MAX_REVIEW_ATTEMPTS = 3;

type QuestionReviewResult = Awaited<ReturnType<typeof reviewSingleQuestion>>;

export async function reviewExtraction(
	config: ProviderConfig,
	sourceText: string,
	extracted: ExamIngestResponse,
	options: ReviewExtractionOptions,
): Promise<IngestReviewResult> {
	const totalQuestions = extracted.questions.length;

	if (totalQuestions === 0) {
		options.onEvent?.({
			type: "warning",
			message: "No extracted questions were available for review.",
		});
		return {
			extracted,
			reviewed: false,
			reviewedQuestionCount: 0,
			failedQuestionCount: 0,
			reasons: ["no_questions"],
		};
	}

	if (Object.keys(options.tools ?? {}).length === 0) {
		options.onEvent?.({
			type: "warning",
			message:
				"Web verification tools are unavailable. Continuing with LLM-only review (no web search/fetch).",
		});
	}

	options.onEvent?.({
		type: "step",
		message: `Reviewing ${totalQuestions} extracted question${totalQuestions === 1 ? "" : "s"} in parallel...`,
	});

	const reviewedQuestions = await reviewAllQuestionsWithRetries(
		config,
		sourceText,
		extracted.questions,
		options,
	);

	const failedQuestionCount = reviewedQuestions.filter(
		(result) => !result.success,
	).length;
	const reviewedQuestionCount = reviewedQuestions.length - failedQuestionCount;
	const questions = reviewedQuestions.map((result) => result.question);

	return {
		extracted: {
			examName: extracted.examName,
			questions,
			topics: deriveTopics(questions, extracted.topics),
		},
		reviewed: true,
		reviewedQuestionCount,
		failedQuestionCount,
		reasons: reviewedQuestions
			.flatMap((result) =>
				"reason" in result && result.reason ? [result.reason] : [],
			)
			.filter(Boolean),
	};
}

async function reviewAllQuestionsWithRetries(
	config: ProviderConfig,
	sourceText: string,
	questions: Question[],
	options: ReviewExtractionOptions,
): Promise<QuestionReviewResult[]> {
	const totalQuestions = questions.length;
	const concurrency = options.concurrency ?? REVIEW_CONCURRENCY;

	const results = await mapWithConcurrency(
		questions,
		concurrency,
		(question, index) =>
			reviewSingleQuestion(
				config,
				sourceText,
				question,
				index,
				totalQuestions,
				options,
			),
	);

	if (results.every((result) => !result.success)) {
		throw new Error(
			`All ${totalQuestions} reviewer${totalQuestions === 1 ? "" : "s"} failed on the first cycle. Aborting review.`,
		);
	}

	for (let attempt = 2; attempt <= MAX_REVIEW_ATTEMPTS; attempt++) {
		const failedIndices = results
			.map((result, index) => (!result.success ? index : -1))
			.filter((index) => index >= 0);

		if (failedIndices.length === 0) {
			break;
		}

		options.onEvent?.({
			type: "step",
			message: `Retrying ${failedIndices.length} failed review${failedIndices.length === 1 ? "" : "s"} (attempt ${attempt}/${MAX_REVIEW_ATTEMPTS})...`,
		});

		const retryResults = await mapWithConcurrency(
			failedIndices,
			concurrency,
			(index) =>
				reviewSingleQuestion(
					config,
					sourceText,
					questions[index],
					index,
					totalQuestions,
					options,
				),
		);

		for (let i = 0; i < failedIndices.length; i++) {
			results[failedIndices[i]] = retryResults[i];
		}
	}

	return results;
}
