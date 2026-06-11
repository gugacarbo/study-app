import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DBQueries } from "@/db/queries";
import {
	improveSingleQuestion,
	IMPROVE_QUESTIONS_STAGE_ID,
} from "@/features/ai/agents/improve-questions";
import type {
	DraftQuestion,
	ImproveQuestionsAgentEvent,
} from "@/features/ai/agents/improve-questions/contracts";
import { toWorkspaceUpdateDataPart } from "@/features/ai/agents/improve-questions/contracts";
import {
	createAgentRunWriter,
	createJobUIMessageStream,
	createJobUIMessageStreamResponse,
	writeJobError,
	writeJobResult,
	writeWorkspaceUpdate,
	type AgentRunDescriptor,
	type JobUIMessageStreamWriter,
} from "@/features/ai/core/ui-message-job-stream";
import { resolveToolsForAgent } from "@/features/ai/tools/tool-resolver";
import { env } from "@/env";

const improveQuestionsRequestSchema = z.object({
	questionId: z.number().int().positive(),
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

function emitImproveAgentEvent(
	agentRuns: ReturnType<typeof createAgentRunWriter>,
	run: AgentRunDescriptor,
	event: ImproveQuestionsAgentEvent,
): void {
	switch (event.eventType) {
		case "lifecycle":
			agentRuns.lifecycle(run, event.status ?? "running", {
				systemPrompt: event.systemPrompt,
				userPrompt: event.userPrompt,
				error: event.error,
				meta: event.meta,
			});
			return;
		case "result":
			agentRuns.result(run, event.finalObject, event.rawText, event.meta);
			return;
		case "warning":
			agentRuns.warning(run, event.warning ?? "Warning", event.meta);
			return;
		case "token":
			agentRuns.token(run, event.tokens, event.meta);
			return;
		case "tool-call":
			agentRuns.toolCall(
				run,
				{
					name: event.name,
					arguments: event.arguments,
					input: event.input,
					output: event.output,
					state: event.state,
				},
				event.meta,
			);
			return;
		case "tool-result":
			agentRuns.toolResult(
				run,
				{
					content: event.content,
					error: event.error,
					state: event.state,
				},
				event.meta,
			);
	}
}

async function runImproveQuestions(
	questionId: number,
	writer: JobUIMessageStreamWriter,
): Promise<void> {
	const { getDB } = await import("@/server-functions/db");
	const db = await getDB();
	if (!db) {
		throw new Error("D1 database not available");
	}

	const queries = new DBQueries(db);
	const questionRow = await queries.getQuestionById(questionId);
	if (!questionRow) {
		throw new Error(`Question ${questionId} was not found`);
	}

	const config = await queries.getAllConfig();
	const { requireModelConfig } = await import("@/lib/ai-config");
	const providerConfig = await requireModelConfig(queries, "improve_questions");

	const draftQuestion = toDraftQuestion(questionRow);
	const agentRuns = createAgentRunWriter(writer);
	const run = agentRuns.createRun(IMPROVE_QUESTIONS_STAGE_ID, "Improve Question");

	const resolvedTools = resolveToolsForAgent({
		agent: "improve_questions",
		config,
		context: {
			queries,
			providerConfig,
			tavilyApiKey: env.TAVILY_API_KEY,
			onWarning: (message) => {
				agentRuns.warning(run, message);
			},
		},
	});

	const result = await improveSingleQuestion(providerConfig, draftQuestion, {
		tools: resolvedTools.tools,
		createAgentRunId: () => run.agentRunId,
		onAgentEvent: (event) => {
			emitImproveAgentEvent(agentRuns, run, event);
		},
		onWorkspaceUpdate: (update) => {
			writeWorkspaceUpdate(writer, toWorkspaceUpdateDataPart(update));
		},
	});

	if (!result.success) {
		writeJobError(writer, { message: result.reason, agentRunId: run.agentRunId });
		return;
	}

	writeJobResult(writer, {
		finalQuestion: result.question,
		agentRun: result.agentRun,
	});
}

export const Route = createFileRoute("/api/improve-questions/")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				const payloadRaw = await request.json().catch(() => null);
				const parsed = improveQuestionsRequestSchema.safeParse(payloadRaw);
				if (!parsed.success) {
					return new Response(
						JSON.stringify({
							error: "Invalid improve-questions payload",
							details: parsed.error.issues,
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const stream = createJobUIMessageStream({
					execute: async ({ writer }) => {
						try {
							await runImproveQuestions(parsed.data.questionId, writer);
						} catch (error) {
							console.error(
								`[${new Date().toISOString()} ERROR improve-questions-handler] Improve question failed:`,
								error,
								`questionId=${parsed.data.questionId}`,
							);
							writeJobError(writer, {
								message:
									error instanceof Error
										? error.message
										: "Unknown improve-questions error",
							});
						}
					},
				});

				return createJobUIMessageStreamResponse(stream);
			},
		},
	},
} as never);
