import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DBQueries } from "@/db/queries";
import {
	explainQuestionById,
	EXPLAIN_QUESTION_AGENT_STAGE_ID,
} from "@/features/ai/agents/explanations/explain-question";
import {
	writeExplanationUpdate,
	writeJobResult,
} from "@/features/ai/core/ui-message-job-stream";
import { createAgentEventEmitter } from "@/features/ai/pipeline/server/agent-emitter";
import { createJobApiRoute } from "@/features/ai/pipeline/server/create-job-api-route";
import { resolveToolsForAgent } from "@/features/ai/tools/tool-resolver";
import { MemoryManager } from "@/lib/memory";
import { buildTopicMemoryResolver } from "@/lib/memory/topic-context";
import { env } from "@/env";

const explainQuestionRequestSchema = z.object({
	questionId: z.number().int().positive(),
	overwrite: z.boolean().default(false),
});

export const Route = createFileRoute("/api/explain-question/")({
	server: {
		handlers: {
			POST: createJobApiRoute({
				schema: explainQuestionRequestSchema,
				logTag: "explain-question-handler",
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

					const hasExplanation = Boolean(questionRow.explanation?.trim());
					const hasDeepExplanation = Boolean(questionRow.deepExplanation?.trim());
					if (!data.overwrite && hasExplanation && hasDeepExplanation) {
						throw new Error("Question already has complete explanations");
					}

					const config = await queries.getAllConfig();
					const { requireModelConfig } = await import("@/lib/ai-config");
					const providerConfig = await requireModelConfig(queries, "explanations");

					const memory = new MemoryManager(db);
					await memory.ensureStructure();
					const topicMemory = await buildTopicMemoryResolver(memory, [
						questionRow.topic ?? "General",
					]);

					const run = agentRuns.createRun(
						EXPLAIN_QUESTION_AGENT_STAGE_ID,
						`Explanation Q${data.questionId}`,
					);
					ctx.stageId = run.stageId;
					ctx.agentRunId = run.agentRunId;

					const emit = createAgentEventEmitter(agentRuns, run, {
						onWarning: (message) => log.warning(message),
					});

					const resolvedTools = resolveToolsForAgent({
						agent: "explanations",
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

					const questionInput = {
						id: questionRow.id,
						question: questionRow.question,
						options: questionRow.options,
						answers: questionRow.answers,
						scoringMode: questionRow.scoringMode,
						topic: questionRow.topic,
						explanation: questionRow.explanation,
						deepExplanation: questionRow.deepExplanation,
					};

					const result = await explainQuestionById(
						providerConfig,
						questionInput,
						{
							tools: resolvedTools.tools,
							emit,
							overwrite: data.overwrite,
							resolveMemoryContext: () =>
								topicMemory.resolveMemoryContext(questionRow.topic),
							createAgentRunId: () => run.agentRunId,
							onWorkspaceUpdate: (update) => {
								writeExplanationUpdate(writer, update);
							},
						},
					);

					if (!result.success) {
						log.error(result.reason, { agentRunId: run.agentRunId });
						throw new Error(result.reason);
					}

					writeJobResult(writer, {
						questionId: data.questionId,
						explanation: result.result.explanation,
						deepExplanation: result.result.deepExplanation,
						agentRun: {
							agentRunId: run.agentRunId,
							label: run.label,
							status: "done",
							systemPrompt: "",
							userPrompt: "",
							meta: {
								questionCount: 1,
								questionIds: [data.questionId],
							},
						},
					});
				},
			}),
		},
	},
} as never);
