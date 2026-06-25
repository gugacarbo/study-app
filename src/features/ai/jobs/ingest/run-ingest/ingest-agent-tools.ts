import { tool } from "ai";
import { z } from "zod";
import {
	extractedQuestionSchema,
	resolvedExtractedQuestionSchema,
	type ResolvedExtractedQuestion,
} from "@/features/ai/jobs/ingest/extracted-question";
import {
	buildIngestStreamProgressPart,
	buildIngestTextPart,
	serializeIngestDataPart,
	serializeIngestJobEventPart,
} from "@/features/ai/jobs/ingest/ingest-events";
import {
	buildStreamToolResultPart,
	serializeIngestStreamPart,
} from "./ingest-stream-parts";
import { canonicalizeReviewQuestion } from "./review-question";

export const FINISH_EXTRACTION_SUMMARY_MAX_LENGTH = 400;
export const finishExtractionAlertSchema = z
	.string()
	.trim()
	.min(1)
	.max(FINISH_EXTRACTION_SUMMARY_MAX_LENGTH);
export const finishExtractionAlertsSchema = z
	.array(finishExtractionAlertSchema)
	.optional();

export const finishExtractionInputSchema = z.object({
	total: z.number().int().nonnegative(),
	summary: z
		.string()
		.trim()
		.min(1)
		.max(FINISH_EXTRACTION_SUMMARY_MAX_LENGTH),
	alerts: finishExtractionAlertsSchema,
});

export type SubmitQuestionResult =
	| { ok: true; index: number; draftQuestionId: string }
	| { ok: false; reason: string };

type UpdateQuestionInput = ResolvedExtractedQuestion & {
	draftQuestionId: string;
};

type UpdateQuestionResult =
	| {
			ok: true;
			question: ResolvedExtractedQuestion & {
				draftQuestionId: string;
				sourceIndex: number;
			};
	  }
	| {
			ok: false;
			reason:
				| "draft_not_found"
				| "option_count_mismatch"
				| "invalid_question";
	  };

export const listQuestionsResultSchema = z.object({
	ok: z.literal(true),
	total: z.number().int().nonnegative(),
	questions: z.array(extractedQuestionSchema),
});

export type ListQuestionsResult = {
	ok: true;
	total: number;
	questions: ResolvedExtractedQuestion[];
};

export type FinishExtractionResult =
	| { ok: false; reason: "questions_not_verified" | "submitted_total_mismatch" }
	| {
			ok: true;
			total: number;
			summary: string;
			alerts?: string[];
			verified: true;
	  };

export type IngestAgentToolsContext = {
	append: (payload: string) => Promise<void>;
	getCurrentMessageId: () => string;
	questions: ResolvedExtractedQuestion[];
	onFinishExtraction: () => void;
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

function formatValidationReason(error: z.ZodError): string {
	const firstIssue = error.issues[0];
	return firstIssue?.message ?? "invalid_question";
}

function buildListQuestionsModelOutput(
	result: ListQuestionsResult,
	draftQuestionIds: string[],
): string {
	return JSON.stringify({
		total: result.total,
		questions: result.questions.map((question, index) => ({
			draftQuestionId: draftQuestionIds[index],
			index: index + 1,
			sourceIndex: index + 1,
			question: question.question,
			options: question.options,
			answers: question.answers,
			topic: question.topic,
			topicId: question.topicId,
		})),
	});
}

export function formatFinalizationSummaryMessage(
	summary: string,
	alerts?: string[],
): string {
	if (!alerts?.length) {
		return summary;
	}

	return `${summary}\n\nAlertas:\n${alerts.map((alert) => `- ${alert}`).join("\n")}`;
}

export function createIngestAgentTools(ctx: IngestAgentToolsContext) {
	let submittedRevision = 0;
	let verifiedRevision = -1;
	const draftQuestionIds: string[] = [];

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
		submit_question: tool({
			description:
				"Submit one extracted multiple-choice question from the exam text.",
			inputSchema: resolvedExtractedQuestionSchema,
			execute: async (input, { toolCallId }) => {
				const parsed = resolvedExtractedQuestionSchema.safeParse(input);
				if (!parsed.success) {
					const result: SubmitQuestionResult = {
						ok: false,
						reason: formatValidationReason(parsed.error),
					};
					await persistToolResult(toolCallId, result, true);
					return result;
				}

				ctx.questions.push(parsed.data);
				submittedRevision += 1;
				const index = ctx.questions.length;
				const draftQuestionId = `draft-${index}`;
				draftQuestionIds.push(draftQuestionId);

				await ctx.append(
					serializeIngestDataPart(buildIngestStreamProgressPart(index)),
				);

				const result: SubmitQuestionResult = {
					ok: true,
					index,
					draftQuestionId,
				};
				await persistToolResult(toolCallId, result);
				return result;
			},
		}),
		list_questions: tool({
			description:
				"List all extracted questions currently buffered so you can verify nothing was missed before finishing extraction.",
			inputSchema: z.object({}),
			outputSchema: listQuestionsResultSchema,
			toModelOutput: async ({ output }) => ({
				type: "text",
				value: buildListQuestionsModelOutput(output, draftQuestionIds),
			}),
			execute: async (_input, { toolCallId }) => {
				verifiedRevision = submittedRevision;
				const result: ListQuestionsResult = {
					ok: true,
					total: ctx.questions.length,
					questions: [...ctx.questions],
				};
				await persistToolResult(toolCallId, result);
				return result;
			},
		}),
		update_question: tool({
			description:
				"Replace one submitted question by id. You may edit all fields, but keep the same number of options.",
			inputSchema: resolvedExtractedQuestionSchema.extend({
				draftQuestionId: z.string().trim().min(1),
			}),
			execute: async (input, { toolCallId }) => {
				const index = draftQuestionIds.findIndex(
					(draftQuestionId) => draftQuestionId === input.draftQuestionId,
				);
				if (index < 0) {
					const result: UpdateQuestionResult = {
						ok: false,
						reason: "draft_not_found",
					};
					await persistToolResult(toolCallId, result, true);
					return result;
				}

				const current = ctx.questions[index];
				if (!current || input.options.length !== current.options.length) {
					const result: UpdateQuestionResult = {
						ok: false,
						reason: "option_count_mismatch",
					};
					await persistToolResult(toolCallId, result, true);
					return result;
				}

				try {
					const nextQuestion = canonicalizeReviewQuestion(
						input as UpdateQuestionInput,
					);
					ctx.questions[index] = nextQuestion;
					submittedRevision += 1;

					const result: UpdateQuestionResult = {
						ok: true,
						question: {
							...nextQuestion,
							draftQuestionId: draftQuestionIds[index]!,
							sourceIndex: index + 1,
						},
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
		finish_extraction: tool({
			description:
				"Signal that question extraction is complete only after calling list_questions to verify every extracted question. Pass the total submitted, a final summary up to 400 characters, and optional alerts when needed.",
			inputSchema: finishExtractionInputSchema,
			execute: async (input, { toolCallId }) => {
				if (verifiedRevision !== submittedRevision) {
					const result: FinishExtractionResult = {
						ok: false,
						reason: "questions_not_verified",
					};
					await persistToolResult(toolCallId, result, true);
					return result;
				}

				if (input.total !== ctx.questions.length) {
					const result: FinishExtractionResult = {
						ok: false,
						reason: "submitted_total_mismatch",
					};
					await persistToolResult(toolCallId, result, true);
					return result;
				}

				ctx.onFinishExtraction();
				const result: FinishExtractionResult = {
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
