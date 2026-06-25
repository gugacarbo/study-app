import { getAiModel } from "@/lib/ai-config";
import { getOrCreateQuestionTopicFromName } from "@/db/queries/question-topics";
import type { BackgroundJobRow, RunIngestContext } from "@/features/ai/jobs/ingest/run-ingest/types";
import {
	runReviewAgent,
	REVIEW_WARNING_FALLBACK,
} from "@/features/ai/jobs/ingest/run-ingest/run-review-agent";
import type { ReviewDraftQuestion } from "@/features/ai/jobs/ingest/run-ingest/review-agent-tools";

export type ReviewQuestionsResult = {
	questions: ReviewDraftQuestion[];
	reviewedCount: number;
	reviewWarning?: typeof REVIEW_WARNING_FALLBACK;
};

export function buildReviewDrafts(
	questions: ReviewDraftQuestion["options"] extends never ? never : Array<{
		question: string;
		options: { key: string; text: string }[];
		answers: string[];
		topic: string;
		topicId: string | null;
	}>,
): ReviewDraftQuestion[] {
	return questions.map((question, index) => ({
		draftQuestionId: `draft-${index + 1}`,
		sourceIndex: index + 1,
		question: question.question,
		options: question.options,
		answers: question.answers,
		topic: question.topic,
		topicId: question.topicId,
	}));
}

export async function resolveDraftTopicIds(
	ctx: RunIngestContext,
	questions: Array<{
		question: string;
		options: { key: string; text: string }[];
		answers: string[];
		topic: string;
		topicId?: string | null;
	}>,
): Promise<ReviewDraftQuestion[]> {
	const resolved: ReviewDraftQuestion[] = [];

	for (let index = 0; index < questions.length; index += 1) {
		const question = questions[index]!;
		const topicRecord = await getOrCreateQuestionTopicFromName(
			ctx.db,
			question.topicId == null ? question.topic : null,
		);

		resolved.push({
			draftQuestionId: `draft-${index + 1}`,
			sourceIndex: index + 1,
			question: question.question,
			options: question.options,
			answers: question.answers,
			topic: question.topic,
			topicId: question.topicId ?? topicRecord?.id ?? null,
		});
	}

	return resolved;
}

export async function reviewQuestions(
	ctx: RunIngestContext,
	job: BackgroundJobRow,
	examId: string,
	rawQuestions: ReviewDraftQuestion[],
): Promise<ReviewQuestionsResult> {
	const resolveModel = ctx.deps.getAiModel ?? getAiModel;

	try {
		const model = await resolveModel({
			db: ctx.db,
			userId: job.userId,
			modelId: JSON.parse(job.metadata ?? "{}").modelId,
		});

		const result = await runReviewAgent({
			ctx,
			model,
			examId,
			drafts: rawQuestions,
			isCancelRequested: () => ctx.deps.isCancelRequested(ctx.jobId),
			streamText: ctx.deps.reviewStreamText ?? ctx.deps.streamText,
		});

		if (!result.ok) {
			return {
				questions: rawQuestions,
				reviewedCount: 0,
				reviewWarning: REVIEW_WARNING_FALLBACK,
			};
		}

		return {
			questions: result.questions,
			reviewedCount: result.reviewedCount,
		};
	} catch {
		return {
			questions: rawQuestions,
			reviewedCount: 0,
			reviewWarning: REVIEW_WARNING_FALLBACK,
		};
	}
}
