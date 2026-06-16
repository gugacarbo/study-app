import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DBQueries } from "@/db/queries";
import {
	improveSingleQuestion,
	IMPROVE_QUESTIONS_STAGE_ID,
} from "@/features/ai/agents/improve-questions";
import type { DraftQuestion } from "@/features/ai/agents/improve-questions/contracts";
import { toWorkspaceUpdateDataPart } from "@/features/ai/agents/improve-questions/contracts";
import {
	writeJobResult,
	writeWorkspaceUpdate,
} from "@/features/ai/core/ui-message-job-stream";
import { createAgentEventEmitter } from "@/features/ai/pipeline/server/agent-emitter";
import { createJobApiRoute } from "@/features/ai/pipeline/server/create-job-api-route";
import { resolveToolsForAgent } from "@/features/ai/tools/tool-resolver";
import { env } from "@/env";

const draftQuestionSchema = z.object({
	id: z.number().int().positive(),
	exam_id: z.number().int().positive().nullable().optional(),
	question: z.string(),
	options: z.array(z.string()),
	answers: z.array(z.string()),
	scoringMode: z.enum(["exact", "partial"]),
	explanation: z.string(),
	deepExplanation: z.string().optional(),
	topic: z.string().optional(),
});

const conversationHistorySchema = z.array(
	z.object({
		role: z.enum(["user", "assistant"]),
		content: z.string(),
	}),
);

const improveQuestionsRequestSchema = z
	.object({
		questionId: z.number().int().positive(),
		followUpMessage: z.string().trim().min(1).optional(),
		draftQuestion: draftQuestionSchema.optional(),
		conversationHistory: conversationHistorySchema.optional(),
	})
	.superRefine((value, ctx) => {
		if (!value.followUpMessage) return;

		if (!value.draftQuestion) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "draftQuestion is required for follow-up requests",
				path: ["draftQuestion"],
			});
		}

		if (!value.conversationHistory) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "conversationHistory is required for follow-up requests",
				path: ["conversationHistory"],
			});
		}
	});

function toDraftQuestion(question: {
	id: number;
	exam_id: number | null;
	question: string;
	options: string[];
	answers: string[];
	scoringMode: "exact" | "partial";
	explanation: string;
	deepExplanation: string;
	topic: string;
}): DraftQuestion {
	return {
		id: question.id,
		exam_id: question.exam_id,
		question: question.question,
		options: [...question.options],
		answers: [...question.answers],
		scoringMode: question.scoringMode,
		explanation: question.explanation,
		deepExplanation: question.deepExplanation,
		topic: question.topic,
	};
}

export const Route = createFileRoute("/api/improve-questions/")({
	server: {
		handlers: {
			POST: createJobApiRoute({
				schema: improveQuestionsRequestSchema,
				logTag: "improve-questions-handler",
				run: async ({ writer, data, agentRuns, ctx, log }) => {
					const { getDB } = await import("@/server-functions/db");
					const db = await getDB();
					if (!db) {
						throw new Error("D1 database not available");
					}

					const queries = new DBQueries(db);
					const questionRow = await queries.getQuestionById(data.questionId);
					if (!questionRow) {
						throw new Error(`Question ${data.questionId} was not found`);
					}

					const config = await queries.getAllConfig();
					const { requireModelConfig } = await import("@/lib/ai-config");
					const providerConfig = await requireModelConfig(
						queries,
						"improve_questions",
					);

					const draftQuestion =
						data.draftQuestion ?? toDraftQuestion(questionRow);
					const run = agentRuns.createRun(
						IMPROVE_QUESTIONS_STAGE_ID,
						"Improve Question",
					);
					ctx.stageId = run.stageId;
					ctx.agentRunId = run.agentRunId;

					const emit = createAgentEventEmitter(agentRuns, run, {
						onWarning: (message) => log.warning(message),
					});

					const resolvedTools = resolveToolsForAgent({
						agent: "improve_questions",
						config,
						context: {
							queries,
							providerConfig,
							tavilyApiKey: env.TAVILY_API_KEY,
							onWarning: (message) => {
								log.warning(message, { agentRunId: run.agentRunId });
								agentRuns.warning(run, message);
							},
						},
					});

					if (resolvedTools.tools.check_spelling) {
						const { warmPtBrSpellChecker } = await import(
							"@/features/ai/tools/spell-tools"
						);
						try {
							await warmPtBrSpellChecker();
						} catch (error) {
							console.warn("Spell checker warmup failed:", error);
							const message =
								"Spell checker warmup failed. check_spelling may be unavailable.";
							log.warning(message, { agentRunId: run.agentRunId });
							agentRuns.warning(run, message);
						}
					}

					const result = await improveSingleQuestion(
						providerConfig,
						draftQuestion,
						{
							tools: resolvedTools.tools,
							emit,
							createAgentRunId: () => run.agentRunId,
							onWorkspaceUpdate: (update) => {
								writeWorkspaceUpdate(
									writer,
									toWorkspaceUpdateDataPart(update),
								);
							},
							...(data.followUpMessage && data.conversationHistory
								? {
										followUp: {
											message: data.followUpMessage,
											history: data.conversationHistory,
										},
									}
								: {}),
						},
					);

					if (!result.success) {
						log.error(result.reason, { agentRunId: run.agentRunId });
						throw new Error(result.reason);
					}

					writeJobResult(writer, {
						finalQuestion: result.question,
						agentRun: result.agentRun,
					});
				},
			}),
		},
	},
} as never);
