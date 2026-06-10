import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DBQueries } from "@/db/queries";
import {
	improveSingleQuestion,
	IMPROVE_QUESTIONS_STAGE_ID,
} from "@/features/ai/agents/improve-questions";
import type { DraftQuestion } from "@/features/ai/agents/improve-questions/contracts";
import { resolveToolsForAgent } from "@/features/ai/tools/tool-resolver";
import { env } from "@/env";
import type { ProviderConfig } from "@/lib/validation";
import { createAgentRunHelpers, formatSSE } from "../ingest/-sse-emitter";

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

async function runImproveQuestions(
	questionId: number,
	send: (event: string, data: unknown) => void,
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
	const apiKey = config.ai_api_key;
	if (!apiKey) {
		throw new Error("AI provider not configured");
	}

	const providerConfig: ProviderConfig = {
		provider: (config.ai_provider || "openrouter") as ProviderConfig["provider"],
		model: config.ai_model || "openai/gpt-4o-mini",
		baseUrl: config.ai_base_url || undefined,
		apiKey,
	};

	const draftQuestion = toDraftQuestion(questionRow);
	const agentRuns = createAgentRunHelpers(send);
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
		onAgentEvent: (event) => {
			send("agent", { ...event, timestamp: event.timestamp ?? Date.now() });
		},
		onWorkspaceUpdate: (update) => {
			send("workspace-update", update);
		},
	});

	if (!result.success) {
		throw new Error(result.reason);
	}

	send("done", {
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

				const encoder = new TextEncoder();
				const stream = new ReadableStream<Uint8Array>({
					start(controller) {
						const send = (event: string, data: unknown) => {
							controller.enqueue(encoder.encode(formatSSE(event, data)));
						};

						void (async () => {
							try {
								await runImproveQuestions(parsed.data.questionId, send);
							} catch (error) {
								console.error(
									`[${new Date().toISOString()} ERROR improve-questions-handler] Improve question failed:`,
									error,
									`questionId=${parsed.data.questionId}`,
								);
								send("error", {
									message:
										error instanceof Error
											? error.message
											: "Unknown improve-questions error",
								});
							} finally {
								controller.close();
							}
						})();
					},
				});

				return new Response(stream, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache, no-transform",
						Connection: "keep-alive",
					},
				});
			},
		},
	},
} as never);
