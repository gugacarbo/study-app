import { stepCountIs, streamText, tool, type ToolSet } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { LanguageModel } from "ai";
import type { AppDatabase } from "@/db/client";
import { createId } from "@/db/queries/helpers";
import {
	createQuestionTopic,
	searchSimilarQuestionTopics,
} from "@/db/queries/question-topics";
import {
	type QuestionImprovementSnapshot,
	upsertPendingQuestionImprovementDraft,
} from "@/db/queries/question-improvement-drafts";
import * as schema from "@/db/schema";
import {
	buildImproveQuestionStageEvent,
	buildImproveQuestionStatusEvent,
	buildImproveQuestionWarningEvent,
	buildImproveStepMessageId,
	buildImproveTextEvent,
	buildImproveToolCallEvent,
	buildImproveToolResultEvent,
} from "@/features/ai/jobs/improve-questions/improve-question-events";
import { TavilyWebContentProvider } from "@/features/ai/providers/web/tavily-content";
import { TavilyWebSearchProvider } from "@/features/ai/providers/web/tavily-search";
import { createWebTools } from "@/features/ai/tools/web-tools";
import { parseQuestionRow } from "@/features/exams/lib/parse-question-fields";
import { QUESTION_IMPROVEMENT_RULES } from "./question-improvement-rules";
import {
	IMPROVE_QUESTION_STAGE,
	type ImproveQuestionStage,
} from "@/lib/job-kinds";

const MAX_AGENT_STEPS = 6;

const questionSnapshotSchema = z.object({
	questionId: z.string().uuid(),
	question: z.string().trim().min(1).max(5000),
	options: z
		.array(
			z.object({
				key: z.string().trim().length(1).regex(/^[A-Z]$/),
				text: z.string().trim().min(1).max(1000),
				explanation: z.string().trim().max(1000).optional().nullable(),
			}),
		)
		.min(2)
		.max(10),
	answers: z.array(z.string().trim().min(1)).min(1),
	topic: z.string().trim().max(30).nullable().optional(),
	topicId: z.string().uuid().nullable().optional(),
	scoringMode: z.enum(["exact", "partial"]),
	explanation: z.string().trim().max(10000).nullable().optional(),
	deepExplanation: z.string().trim().max(10000).nullable().optional(),
	summary: z.string().trim().max(400).nullable().optional(),
});

function buildPrompt(questionId: string, writeOptionExplanations?: boolean): string {
	const lines = [
		`Improve question ${questionId}.`,
		"Always call get_question first.",
		"Then produce a complete improved version of the same question.",
		"Set topic as a summary of the question text with at most 30 characters.",
		"Search similar topics first and create a new topic only when no candidate fits.",
		...QUESTION_IMPROVEMENT_RULES,
		"Persist the final improved question by calling update_question_draft exactly once.",
		"You may use web_search and web_fetch when external context helps.",
	];
	if (writeOptionExplanations) {
		const persistIdx = lines.findIndex((l) => l.startsWith("Persist the final"));
		if (persistIdx !== -1) {
			lines.splice(
				persistIdx,
				0,
				"Also generate an explanation for each option explaining why it is correct or incorrect in the context of the question. Each explanation must be at most 1000 characters.",
			);
		}
	}
	return lines.join("\n");
}

export async function runImproveQuestionAgent(input: {
	db: AppDatabase;
	jobId: string;
	userId: string;
	examId: string;
	questionId: string;
	model: LanguageModel;
	streamText?: typeof streamText;
	appendJobEvent: (jobId: string, payload: unknown) => Promise<void>;
	webSearchApiKey?: string;
	writeOptionExplanations?: boolean;
}): Promise<{ summary: string | null }> {
	await input.appendJobEvent(
		input.jobId,
		buildImproveQuestionStageEvent(
			input.questionId,
			IMPROVE_QUESTION_STAGE.LOADING_QUESTION,
		),
	);

	const rows = await input.db
		.select()
		.from(schema.questions)
		.innerJoin(schema.exams, eq(schema.exams.id, schema.questions.examId))
		.where(
			and(
				eq(schema.questions.id, input.questionId),
				eq(schema.questions.examId, input.examId),
				eq(schema.exams.userId, input.userId),
			),
		)
		.limit(1);

	const firstRow = rows[0]?.questions;
	if (!firstRow) {
		throw new Error(`Question ${input.questionId} was not found`);
	}

	const question = parseQuestionRow(firstRow);
	if (!question) {
		throw new Error(`Question ${input.questionId} has invalid stored JSON`);
	}

	const originalSnapshot: QuestionImprovementSnapshot = {
		question: question.question,
		options: question.options,
		answers: question.answers,
		topicId: question.topicId ?? null,
		topic: question.topic,
		scoringMode: question.scoringMode,
		explanation: question.explanation,
		deepExplanation: question.deepExplanation,
	};

	let latestSummary: string | null = null;
	let draftPersisted = false;
	let currentMessageId = buildImproveStepMessageId(input.questionId, 1);
	let currentStage: ImproveQuestionStage = IMPROVE_QUESTION_STAGE.DRAFTING;

	const emitQuestionStage = async (stage: ImproveQuestionStage) => {
		if (currentStage === stage) return;
		currentStage = stage;
		await input.appendJobEvent(
			input.jobId,
			buildImproveQuestionStageEvent(input.questionId, stage),
		);
	};

	await emitQuestionStage(IMPROVE_QUESTION_STAGE.DRAFTING);

	const baseTools = {
		get_question: tool({
			description:
				"Load the current full question by questionId before proposing changes.",
			inputSchema: z.object({
				questionId: z.string().uuid(),
			}),
			execute: async ({ questionId }, context) => {
				if (questionId !== input.questionId) {
					throw new Error("This agent may only read its assigned question");
				}
				const result = {
					ok: true as const,
					data: {
						questionId: input.questionId,
						...originalSnapshot,
					},
				};
				if (context?.toolCallId) {
					await input.appendJobEvent(
						input.jobId,
						buildImproveToolResultEvent({
							questionId: input.questionId,
							messageId: currentMessageId,
							toolCallId: context.toolCallId,
							result,
						}),
					);
				}
				return result;
			},
		}),
		update_question_draft: tool({
			description:
				"Persist the complete improved version of the assigned question as a pending review draft.",
			inputSchema: questionSnapshotSchema,
			execute: async (payload, context) => {
				const parsed = questionSnapshotSchema.parse(payload);
				if (parsed.questionId !== input.questionId) {
					throw new Error("This agent may only update its assigned question");
				}

				await emitQuestionStage(IMPROVE_QUESTION_STAGE.SAVING_DRAFT);
				latestSummary = parsed.summary ?? null;
				await upsertPendingQuestionImprovementDraft(input.db, {
					id: createId(),
					userId: input.userId,
					examId: input.examId,
					questionId: input.questionId,
					jobId: input.jobId,
					originalSnapshot,
					improvedSnapshot: {
						question: parsed.question,
						options: parsed.options,
						answers: parsed.answers,
						topicId: parsed.topicId ?? null,
						topic: parsed.topic ?? null,
						scoringMode: parsed.scoringMode,
						explanation: parsed.explanation ?? null,
						deepExplanation: parsed.deepExplanation ?? null,
					},
					summary: latestSummary,
					metadata: null,
				});
				draftPersisted = true;
				const result = { ok: true as const };
				if (context?.toolCallId) {
					await input.appendJobEvent(
						input.jobId,
						buildImproveToolResultEvent({
							questionId: input.questionId,
							messageId: currentMessageId,
							toolCallId: context.toolCallId,
							result,
						}),
					);
				}
				return result;
			},
		}),
		search_similar_topics: tool({
			description:
				"Search similar existing global question topics by textual similarity.",
			inputSchema: z.object({
				query: z.string().trim().min(1).max(200),
				limit: z.number().int().min(1).max(10).optional(),
			}),
			execute: async (payload, context) => {
				const topics = await searchSimilarQuestionTopics(input.db, payload);
				const result = {
					ok: true as const,
					topics: topics.map((topic) => ({
						topicId: topic.id,
						name: topic.name,
						normalizedName: topic.normalizedName,
						similarityLabel: topic.similarityLabel,
					})),
				};
				if (context?.toolCallId) {
					await input.appendJobEvent(
						input.jobId,
						buildImproveToolResultEvent({
							questionId: input.questionId,
							messageId: currentMessageId,
							toolCallId: context.toolCallId,
							result,
						}),
					);
				}
				return result;
			},
		}),
		create_topic: tool({
			description:
				"Create a new global question topic when no similar candidate is suitable.",
			inputSchema: z.object({
				name: z.string().trim().min(1).max(200),
			}),
			execute: async ({ name }, context) => {
				const created = await createQuestionTopic(input.db, name);
				const result = {
					ok: true as const,
					topic: {
						topicId: created.topic.id,
						name: created.topic.name,
						normalizedName: created.topic.normalizedName,
					},
					created: created.created,
				};
				if (context?.toolCallId) {
					await input.appendJobEvent(
						input.jobId,
						buildImproveToolResultEvent({
							questionId: input.questionId,
							messageId: currentMessageId,
							toolCallId: context.toolCallId,
							result,
						}),
					);
				}
				return result;
			},
		}),
	};

	const tools: ToolSet = { ...baseTools };

	if (input.webSearchApiKey) {
		Object.assign(
			tools,
			createWebTools(
				new TavilyWebSearchProvider({ apiKey: input.webSearchApiKey }),
				new TavilyWebContentProvider({ apiKey: input.webSearchApiKey }),
				{
					onWarning: async (message) => {
						await input.appendJobEvent(input.jobId, {
							...buildImproveQuestionWarningEvent(input.questionId, message),
						});
					},
				},
			),
		);
	}

	const runStreamText = input.streamText ?? streamText;
	const result = runStreamText({
		model: input.model,
		system:
			"You improve one multiple-choice exam question at a time. Work in isolation, keep the output internally consistent, and persist only a complete final draft.",
		prompt: buildPrompt(input.questionId, input.writeOptionExplanations),
		tools,
		stopWhen: [stepCountIs(MAX_AGENT_STEPS)],
	});

	for await (const part of result.fullStream) {
		if (part.type === "start-step") {
			const nextStep =
				Number.parseInt(currentMessageId.split(":").at(-1) ?? "1", 10) + 1;
			currentMessageId = buildImproveStepMessageId(input.questionId, nextStep);
			continue;
		}
		if (part.type === "text-delta") {
			await input.appendJobEvent(
				input.jobId,
				buildImproveTextEvent(input.questionId, currentMessageId, part.text),
			);
		}
		if (part.type === "tool-call") {
			if (part.toolName === "web_search" || part.toolName === "web_fetch") {
				await emitQuestionStage(IMPROVE_QUESTION_STAGE.RESEARCHING);
			}
			await input.appendJobEvent(
				input.jobId,
				buildImproveToolCallEvent({
					questionId: input.questionId,
					messageId: currentMessageId,
					toolCallId: part.toolCallId,
					toolName: part.toolName,
					argsText: JSON.stringify(part.input),
				}),
			);
			if (part.toolName !== "web_search" && part.toolName !== "web_fetch") {
				await emitQuestionStage(IMPROVE_QUESTION_STAGE.DRAFTING);
			}
		}
		if (part.type === "error") {
			await input.appendJobEvent(
				input.jobId,
				buildImproveQuestionStatusEvent({
					questionId: input.questionId,
					status: "failed",
					error:
						part.error instanceof Error ? part.error.message : "unknown_error",
				}),
			);
			throw part.error;
		}
	}

	if (!draftPersisted) {
		await input.appendJobEvent(
			input.jobId,
			buildImproveQuestionStatusEvent({
				questionId: input.questionId,
				status: "failed",
				error: "Improve question agent finished without persisting a draft",
			}),
		);
		throw new Error("Improve question agent finished without persisting a draft");
	}

	return { summary: latestSummary };
}
