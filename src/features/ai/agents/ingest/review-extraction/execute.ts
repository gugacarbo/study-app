import type { ExamIngestResponse, ProviderConfig, Question } from "@/lib/validation";
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

	if (!options.tools?.length) {
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
	const results: QuestionReviewResult[] = new Array(totalQuestions);

	for (
		let batchStart = 0;
		batchStart < totalQuestions;
		batchStart += REVIEW_CONCURRENCY
	) {
		const batchEnd = Math.min(batchStart + REVIEW_CONCURRENCY, totalQuestions);
		const batchSize = batchEnd - batchStart;
		const isFirstBatch = batchStart === 0;

		let batchResults = await Promise.all(
			Array.from({ length: batchSize }, (_, offset) => {
				const index = batchStart + offset;
				return reviewSingleQuestion(
					config,
					sourceText,
					questions[index],
					index,
					totalQuestions,
					options,
				);
			}),
		);

		if (isFirstBatch && batchResults.every((result) => !result.success)) {
			throw new Error(
				`All ${batchSize} reviewer${batchSize === 1 ? "" : "s"} failed on the first batch. Aborting review.`,
			);
		}

		for (let attempt = 2; attempt <= MAX_REVIEW_ATTEMPTS; attempt++) {
			const failedLocalIndices = batchResults
				.map((result, localIndex) => (!result.success ? localIndex : -1))
				.filter((localIndex) => localIndex >= 0);

			if (failedLocalIndices.length === 0) {
				break;
			}

			options.onEvent?.({
				type: "step",
				message: `Retrying ${failedLocalIndices.length} failed review${failedLocalIndices.length === 1 ? "" : "s"} (attempt ${attempt}/${MAX_REVIEW_ATTEMPTS})...`,
			});

			const retryOptions = reviewOptionsForAttempt(options, attempt);
			await Promise.all(
				failedLocalIndices.map(async (localIndex) => {
					const index = batchStart + localIndex;
					batchResults[localIndex] = await reviewSingleQuestion(
						config,
						sourceText,
						questions[index],
						index,
						totalQuestions,
						retryOptions,
					);
				}),
			);
		}

		for (let offset = 0; offset < batchSize; offset++) {
			results[batchStart + offset] = batchResults[offset];
		}
	}

	return results;
}

function reviewOptionsForAttempt(
	options: ReviewExtractionOptions,
	attempt: number,
): ReviewExtractionOptions {
	if (attempt <= 1) {
		return options;
	}

	const retryNumber = attempt - 1;
	return {
		...options,
		createAgentRunId: (label) =>
			options.createAgentRunId?.(`${label} (retry ${retryNumber})`) ??
			`${label}-retry-${retryNumber}`,
	};
}
