import type { ExamIngestResponse, ProviderConfig } from "@/lib/validation";
import { mapWithConcurrency } from "./execute-helpers";
import { deriveTopics } from "./prompt";
import { reviewSingleQuestion } from "./review-question";
import type { IngestReviewResult, ReviewExtractionOptions } from "./types";

const REVIEW_CONCURRENCY = 10;

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

	const reviewedQuestions = await mapWithConcurrency(
		extracted.questions,
		REVIEW_CONCURRENCY,
		async (question, index) =>
			reviewSingleQuestion(
				config,
				sourceText,
				question,
				index,
				totalQuestions,
				options,
			),
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
