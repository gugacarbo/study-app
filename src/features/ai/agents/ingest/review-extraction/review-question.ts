import type { StreamChunk, StructuredOutputCompleteEvent } from "@tanstack/ai";
import { generateJsonStream } from "@/features/ai/core/generate";
import type { ProviderConfig, Question } from "@/lib/validation";
import { ingestQuestionSchema } from "@/lib/validation";
import { emitAgentEvent } from "./execute-helpers";
import { buildReviewerSystemPrompt, buildReviewerUserPrompt } from "./prompt";
import type { ReviewExtractionOptions } from "./types";

const reviewerQuestionSchema = ingestQuestionSchema;

export async function reviewSingleQuestion(
	config: ProviderConfig,
	sourceText: string,
	question: Question,
	index: number,
	totalQuestions: number,
	options: ReviewExtractionOptions,
): Promise<
	| { question: Question; success: true }
	| { question: Question; success: false; reason: string }
> {
	const label = `Reviewer Q${index + 1}`;
	const agentRunId =
		options.createAgentRunId?.(label) ?? `review-question-${index + 1}`;
	const systemPrompt = buildReviewerSystemPrompt(options.reviewTopics);
	const userPrompt = buildReviewerUserPrompt(sourceText, question, index);
	let rawText = "";

	emitAgentEvent(options, {
		eventType: "lifecycle",
		stageId: "review",
		agentRunId,
		label,
		status: "pending",
		systemPrompt,
		userPrompt,
		meta: {
			questionIndex: index,
			questionNumber: index + 1,
			topic: question.topic ?? "General",
		},
	});
	emitAgentEvent(options, {
		eventType: "lifecycle",
		stageId: "review",
		agentRunId,
		label,
		status: "running",
		meta: { questionIndex: index, questionNumber: index + 1 },
	});

	try {
		const reviewedQuestion = await generateJsonStream<Question>(
			config,
			userPrompt,
			reviewerQuestionSchema,
			{
				system: systemPrompt,
				tools: options.tools,
				onChunk: (
					chunk: StreamChunk | StructuredOutputCompleteEvent<Question>,
				) => {
					if (isTextChunk(chunk) && chunk.delta) {
						rawText += chunk.delta;
					}

					if ("usage" in chunk && chunk.usage) {
						emitAgentEvent(options, {
							eventType: "token",
							stageId: "review",
							agentRunId,
							label,
							tokens: chunk.usage,
							meta: { questionIndex: index, questionNumber: index + 1 },
						});
					}

					if (isToolCallEndChunk(chunk)) {
						const toolMeta = {
							questionIndex: index,
							questionNumber: index + 1,
							toolCallId:
								typeof chunk.toolCallId === "string"
									? chunk.toolCallId
									: undefined,
						};
						const toolEvent = buildToolEvent(chunk);
						emitAgentEvent(options, {
							eventType: "tool-call",
							stageId: "review",
							agentRunId,
							label,
							name: toolEvent.name,
							arguments: toolEvent.arguments,
							input: toolEvent.input,
							output: toolEvent.output,
							state: "complete",
							meta: toolMeta,
						});
						emitAgentEvent(options, {
							eventType: "tool-result",
							stageId: "review",
							agentRunId,
							label,
							content: toolEvent.resultContent,
							error: toolEvent.resultError,
							state: toolEvent.resultError ? "error" : "complete",
							meta: toolMeta,
						});
						rawText += buildToolResultLogLine(chunk);
					}
				},
			},
		);

		emitAgentEvent(options, {
			eventType: "result",
			stageId: "review",
			agentRunId,
			label,
			finalObject: reviewedQuestion,
			rawText,
			meta: { questionIndex: index, questionNumber: index + 1 },
		});
		emitAgentEvent(options, {
			eventType: "lifecycle",
			stageId: "review",
			agentRunId,
			label,
			status: "done",
			meta: { questionIndex: index, questionNumber: index + 1 },
		});

		return { question: reviewedQuestion, success: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		console.error(
			`[${new Date().toISOString()} ERROR review-extraction] ` +
				`Review Q${index + 1}/${totalQuestions} failed: ${message}`,
			`question="${question.question.slice(0, 120)}..."`,
			`topic=${question.topic ?? "General"}`,
		);

		emitAgentEvent(options, {
			eventType: "lifecycle",
			stageId: "review",
			agentRunId,
			label,
			status: "error",
			error: message,
			meta: { questionIndex: index, questionNumber: index + 1 },
		});
		emitAgentEvent(options, {
			eventType: "warning",
			stageId: "review",
			agentRunId,
			label,
			warning: `Review failed for question #${index + 1}. Keeping the original extracted question.`,
			meta: { questionIndex: index, questionNumber: index + 1 },
		});

		return { question, success: false, reason: message };
	}
}

function isTextChunk(
	chunk: StreamChunk | StructuredOutputCompleteEvent<Question>,
): chunk is Extract<
	StreamChunk,
	{ type: "TEXT_MESSAGE_CONTENT"; delta: string }
> {
	return chunk.type === "TEXT_MESSAGE_CONTENT";
}

function isToolCallEndChunk(
	chunk: StreamChunk | StructuredOutputCompleteEvent<Question>,
): chunk is Extract<StreamChunk, { type: "TOOL_CALL_END" }> {
	return chunk.type === "TOOL_CALL_END";
}

function buildToolEvent(
	chunk: Extract<StreamChunk, { type: "TOOL_CALL_END" }>,
) {
	const toolName = chunk.toolCallName ?? chunk.toolName ?? "unknown_tool";
	const input = chunk.input ?? {};
	const result = chunk.result;

	return {
		name: toolName,
		arguments: JSON.stringify(input),
		input,
		output: result,
		resultContent: result,
		resultError: readToolResultError(result),
	};
}

function buildToolResultLogLine(
	chunk: Extract<StreamChunk, { type: "TOOL_CALL_END" }>,
) {
	const toolEvent = buildToolEvent(chunk);
	const result =
		toolEvent.resultContent === undefined
			? ""
			: typeof toolEvent.resultContent === "string"
				? toolEvent.resultContent
				: JSON.stringify(toolEvent.resultContent);

	return `\n[tool:${toolEvent.name}] input=${toolEvent.arguments}${result ? ` result=${result}` : ""}`;
}

function readToolResultError(result: unknown): string | undefined {
	if (typeof result !== "object" || result === null) return undefined;
	const errorValue = (result as { error?: unknown }).error;
	if (typeof errorValue !== "object" || errorValue === null) return undefined;
	return typeof (errorValue as { message?: unknown }).message === "string"
		? (errorValue as { message: string }).message
		: undefined;
}
