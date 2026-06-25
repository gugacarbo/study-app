import { tool } from "ai";
import { z } from "zod";
import {
	resolvedExtractedQuestionSchema,
	type ResolvedExtractedQuestion,
} from "@/features/ai/jobs/ingest/extracted-question";
import { buildIngestTextPart, serializeIngestJobEventPart } from "@/features/ai/jobs/ingest/ingest-events";
import {
	buildStreamToolResultPart,
	serializeIngestStreamPart,
} from "@/features/ai/jobs/ingest/run-ingest/ingest-stream-parts";
import {
	FINISH_EXTRACTION_SUMMARY_MAX_LENGTH,
	finishExtractionAlertsSchema,
	formatFinalizationSummaryMessage,
} from "@/features/ai/jobs/ingest/run-ingest/ingest-agent-tools";
import { canonicalizeReviewQuestion } from "@/features/ai/jobs/ingest/run-ingest/review-question";

export type ReviewDraftQuestion = ResolvedExtractedQuestion & {
	draftQuestionId: string;
	sourceIndex: number;
};

const reviewDraftQuestionSchema = resolvedExtractedQuestionSchema.extend({
	draftQuestionId: z.string().trim().min(1),
	sourceIndex: z.number().int().positive(),
});

const updateQuestionInputSchema = resolvedExtractedQuestionSchema.extend({
	draftQuestionId: z.string().trim().min(1),
});

const finishReviewInputSchema = z.object({
	total: z.number().int().nonnegative(),
	summary: z.string().trim().min(1).max(FINISH_EXTRACTION_SUMMARY_MAX_LENGTH),
	alerts: finishExtractionAlertsSchema,
});

type UpdateQuestionResult =
	| { ok: true; question: ReviewDraftQuestion }
	| {
			ok: false;
			reason:
				| "draft_not_found"
				| "option_count_mismatch"
				| "invalid_question";
	  };

type ListQuestionsResult = {
	ok: true;
	total: number;
	questions: ReviewDraftQuestion[];
};

type FinishReviewResult =
	| { ok: false; reason: "questions_not_verified" | "submitted_total_mismatch" }
	| {
			ok: true;
			total: number;
			summary: string;
			alerts?: string[];
			verified: true;
	  };

export type ReviewAgentToolsContext = {
	append: (payload: string) => Promise<void>;
	getCurrentMessageId: () => string;
	drafts: ReviewDraftQuestion[];
	onFinishReview: () => void;
	searchSimilarTopics?: (input: {
		query: string;
		limit?: number;
	}) => Promise<
		Array<{
			topicId: string;
			name: string;
			normalizedName: string;
			similarityLabel:
				| "exact"
				| "normalized_exact"
				| "prefix"
				| "partial";
		}>
	>;
	createTopic?: (name: string) => Promise<{
		topicId: string;
		name: string;
		normalizedName: string;
		created?: boolean;
	}>;
};

export function createReviewAgentTools(ctx: ReviewAgentToolsContext) {
	let submittedRevision = 0;
	let verifiedRevision = -1;

	const persistToolResult = async (
		toolCallId: string,
		result: unknown,
		isError?: boolean,
	) => {
		await ctx.append(
			serializeIngestStreamPart(
				buildStreamToolResultPart({
					messageId: ctx.getCurrentMessageId(),
					toolCallId,
					result,
					isError,
				}),
			),
		);
	};

	return {
		list_questions: tool({
			description:
				"List all buffered draft questions so you can verify every reviewed question before finishing.",
			inputSchema: z.object({}),
			execute: async (_input, { toolCallId }) => {
				verifiedRevision = submittedRevision;
				const result: ListQuestionsResult = {
					ok: true,
					total: ctx.drafts.length,
					questions: ctx.drafts.map((draft) => reviewDraftQuestionSchema.parse(draft)),
				};
				await persistToolResult(toolCallId, result);
				return result;
			},
		}),
		update_question: tool({
			description:
				"Replace one reviewed draft question by id. You may edit all fields, but keep the same number of options.",
			inputSchema: updateQuestionInputSchema,
			execute: async (input, { toolCallId }) => {
				const index = ctx.drafts.findIndex(
					(draft) => draft.draftQuestionId === input.draftQuestionId,
				);
				if (index < 0) {
					const result: UpdateQuestionResult = {
						ok: false,
						reason: "draft_not_found",
					};
					await persistToolResult(toolCallId, result, true);
					return result;
				}

				const current = ctx.drafts[index];
				if (!current || input.options.length !== current.options.length) {
					const result: UpdateQuestionResult = {
						ok: false,
						reason: "option_count_mismatch",
					};
					await persistToolResult(toolCallId, result, true);
					return result;
				}

				try {
					const reviewed = canonicalizeReviewQuestion(input);
					const nextDraft: ReviewDraftQuestion = {
						...reviewed,
						draftQuestionId: current.draftQuestionId,
						sourceIndex: current.sourceIndex,
					};
					ctx.drafts[index] = nextDraft;
					submittedRevision += 1;

					const result: UpdateQuestionResult = {
						ok: true,
						question: nextDraft,
					};
					await persistToolResult(toolCallId, result);
					return result;
				} catch {
					const result: UpdateQuestionResult = {
						ok: false,
						reason: "invalid_question",
					};
					await persistToolResult(toolCallId, result, true);
					return result;
				}
			},
		}),
		search_similar_topics: tool({
			description:
				"Search similar existing global question topics by textual similarity.",
			inputSchema: z.object({
				query: z.string().trim().min(1).max(200),
				limit: z.number().int().min(1).max(10).optional(),
			}),
			execute: async (input, { toolCallId }) => {
				const topics = await ctx.searchSimilarTopics?.(input);
				const result = {
					ok: true as const,
					topics: topics ?? [],
				};
				await persistToolResult(toolCallId, result);
				return result;
			},
		}),
		create_topic: tool({
			description:
				"Create a new global question topic when no similar candidate is suitable.",
			inputSchema: z.object({
				name: z.string().trim().min(1).max(200),
			}),
			execute: async (input, { toolCallId }) => {
				const topic = await ctx.createTopic?.(input.name);
				if (!topic) {
					const result = {
						ok: false as const,
						reason: "topic_creation_unavailable",
					};
					await persistToolResult(toolCallId, result, true);
					return result;
				}
				const result = {
					ok: true as const,
					topic: {
						topicId: topic.topicId,
						name: topic.name,
						normalizedName: topic.normalizedName,
					},
					created: topic.created ?? true,
				};
				await persistToolResult(toolCallId, result);
				return result;
			},
		}),
		finish_review: tool({
			description:
				"Finish the review only after calling list_questions and confirming the reviewed total. Include a final summary up to 400 characters and optional alerts when needed.",
			inputSchema: finishReviewInputSchema,
			execute: async (input, { toolCallId }) => {
				if (verifiedRevision !== submittedRevision) {
					const result: FinishReviewResult = {
						ok: false,
						reason: "questions_not_verified",
					};
					await persistToolResult(toolCallId, result, true);
					return result;
				}
				if (input.total !== ctx.drafts.length) {
					const result: FinishReviewResult = {
						ok: false,
						reason: "submitted_total_mismatch",
					};
					await persistToolResult(toolCallId, result, true);
					return result;
				}

				ctx.onFinishReview();
				const result: FinishReviewResult = {
					ok: true,
					total: input.total,
					summary: input.summary,
					...(input.alerts?.length ? { alerts: input.alerts } : {}),
					verified: true,
				};
				await persistToolResult(toolCallId, result);
				await ctx.append(
					serializeIngestJobEventPart(
						buildIngestTextPart(
							formatFinalizationSummaryMessage(input.summary, input.alerts),
						),
					),
				);
				return result;
			},
		}),
	};
}
