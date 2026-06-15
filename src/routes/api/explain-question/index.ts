import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DBQueries } from "@/db/queries";
import {
	explainSingleQuestion,
	type ExplanationAgentRunEvent,
} from "@/features/ai/agents/explanations";
import { EXPLAIN_QUESTION_STAGE_ID } from "@/features/ai/agents/explanations/contracts";
import {
	createAgentRunWriter,
	createJobUIMessageStream,
	createJobUIMessageStreamResponse,
	writeJobError,
	writeJobResult,
	type AgentRunDescriptor,
	type JobUIMessageStreamWriter,
} from "@/features/ai/core/ui-message-job-stream";
import { MemoryManager } from "@/lib/memory";
import { buildTopicMemoryResolver } from "@/lib/memory/topic-context";

const explainQuestionRequestSchema = z.object({
	questionId: z.number().int().positive(),
	overwrite: z.boolean().default(false),
});

function emitExplainAgentEvent(
	agentRuns: ReturnType<typeof createAgentRunWriter>,
	run: AgentRunDescriptor,
	event: ExplanationAgentRunEvent,
): void {
	const meta = event.meta as Record<string, unknown> | undefined;

	switch (event.eventType) {
		case "lifecycle":
			agentRuns.lifecycle(run, event.status ?? "running", {
				systemPrompt: event.systemPrompt,
				userPrompt: event.userPrompt,
				error: event.error,
				meta,
			});
			return;
		case "result":
			agentRuns.result(run, event.finalObject, event.rawText, meta);
			return;
		case "warning":
			agentRuns.warning(run, event.warning ?? "Warning", meta);
			return;
		case "token":
			agentRuns.token(run, event.tokens, meta);
			return;
		case "tool-call":
			agentRuns.toolCall(
				run,
				{
					name: event.name,
					arguments: event.arguments,
					input: event.input,
					state: event.state as
						| "awaiting-input"
						| "input-streaming"
						| "input-complete"
						| undefined,
				},
				meta,
			);
			return;
		case "tool-result":
			agentRuns.toolResult(
				run,
				{
					content: event.content,
					error: event.error,
					state: event.state as "streaming" | "complete" | "error" | undefined,
				},
				meta,
			);
	}
}

async function runExplainQuestion(
	questionId: number,
	overwrite: boolean,
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

	const hasExplanation = Boolean(questionRow.explanation?.trim());
	const hasDeepExplanation = Boolean(questionRow.deepExplanation?.trim());
	if (!overwrite && hasExplanation && hasDeepExplanation) {
		throw new Error("Question already has complete explanations");
	}

	const { requireModelConfig } = await import("@/lib/ai-config");
	const providerConfig = await requireModelConfig(queries, "explanations");

	const memory = new MemoryManager(db);
	await memory.ensureStructure();
	const topicMemory = await buildTopicMemoryResolver(memory, [
		questionRow.topic ?? "General",
	]);

	const agentRuns = createAgentRunWriter(writer);
	const run = agentRuns.createRun(
		EXPLAIN_QUESTION_STAGE_ID,
		`Explanation Q${questionId}`,
	);

	const questionInput = {
		id: questionRow.id,
		question: questionRow.question,
		options: questionRow.options,
		answers: questionRow.answers,
		scoringMode: questionRow.scoringMode,
		topic: questionRow.topic,
		explanation: questionRow.explanation,
	};

	const result = await explainSingleQuestion(
		providerConfig,
		questionInput,
		0,
		1,
		{
			resolveMemoryContext: () =>
				topicMemory.resolveMemoryContext(questionRow.topic),
			createAgentRunId: () => run.agentRunId,
			onAgentEvent: (event) => {
				emitExplainAgentEvent(agentRuns, run, event);
			},
		},
	);

	if (!result.success) {
		writeJobError(writer, { message: result.reason, agentRunId: run.agentRunId });
		return;
	}

	const explanation = result.result.explanation.trim();
	const deepExplanation = result.result.deepExplanation.trim();

	await queries.updateQuestion(questionId, {
		explanation,
		deepExplanation,
	});

	writeJobResult(writer, {
		questionId,
		explanation,
		deepExplanation,
		agentRun: {
			agentRunId: run.agentRunId,
			label: run.label,
			status: "done",
			systemPrompt: "",
			userPrompt: "",
			meta: {
				questionCount: 1,
				questionIds: [questionId],
			},
		},
	});
}

export const Route = createFileRoute("/api/explain-question/")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				const payloadRaw = await request.json().catch(() => null);
				const parsed = explainQuestionRequestSchema.safeParse(payloadRaw);
				if (!parsed.success) {
					return new Response(
						JSON.stringify({
							error: "Invalid explain-question payload",
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
							await runExplainQuestion(
								parsed.data.questionId,
								parsed.data.overwrite,
								writer,
							);
						} catch (error) {
							console.error(
								`[${new Date().toISOString()} ERROR explain-question-handler] Explain question failed:`,
								error,
								`questionId=${parsed.data.questionId}`,
							);
							writeJobError(writer, {
								message:
									error instanceof Error
										? error.message
										: "Unknown explain-question error",
							});
						}
					},
				});

				return createJobUIMessageStreamResponse(stream);
			},
		},
	},
} as never);
