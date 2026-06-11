import { stepCountIs, streamText, type ToolSet } from "ai";
import { buildProviderOptions } from "@/features/ai/adapters/provider-options";
import { getAiModel } from "@/features/ai/adapters/provider-model";
import {
	createAiStreamState,
	createToolResultEmitter,
	isAiStreamRunErrorChunk,
	processAiStreamPart,
} from "@/features/ai/core/ai-stream-handler";
import type {
	ExtractionWorkspaceQuestion,
	ExtractionWorkspaceState,
} from "@/features/ai/tools/ingest-tools";
import {
	createExtractionWorkspace,
	createIngestExtractionTools,
} from "@/features/ai/tools/ingest-tools";
import type { ProviderConfig, Question } from "@/lib/validation";
import { emitAgentEvent } from "./execute-helpers";
import { buildReviewerSystemPrompt, buildReviewerUserPrompt } from "./prompt";
import type { ReviewExtractionOptions } from "./types";

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
	const workspace = createExtractionWorkspace(
		createReviewWorkspaceState(question),
	);
	const workspaceTools = createIngestExtractionTools(workspace);
	const combinedTools: ToolSet = {
		...workspaceTools,
		...(options.tools ?? {}),
	};
	const streamState = createAiStreamState();
	const toolNamesById = new Map<string, string>();
	const toolFailureMessages: string[] = [];
	let hasSuccessfulUpdate = false;

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
		const handleToolCall = (toolCall: {
			toolCallId: string;
			name?: string;
			arguments?: string;
			input?: unknown;
			state: "awaiting-input" | "input-streaming" | "input-complete";
		}) => {
			if (toolCall.state === "input-streaming") {
				if (toolCall.name) {
					toolNamesById.set(toolCall.toolCallId, toolCall.name);
				}
				return;
			}

			if (toolCall.name) {
				toolNamesById.set(toolCall.toolCallId, toolCall.name);
			}
			emitAgentEvent(options, {
				eventType: "tool-call",
				stageId: "review",
				agentRunId,
				label,
				name: toolCall.name,
				arguments: toolCall.arguments,
				input: toolCall.input,
				state: toolCall.state,
				meta: {
					questionIndex: index,
					questionNumber: index + 1,
					toolCallId: toolCall.toolCallId,
				},
			});
		};

		const handleToolResult = (toolResult: {
			toolCallId: string;
			content?: unknown;
			error?: string;
			state: "streaming" | "complete" | "error";
		}) => {
			emitAgentEvent(options, {
				eventType: "tool-result",
				stageId: "review",
				agentRunId,
				label,
				content: toolResult.content,
				error: toolResult.error,
				state: toolResult.state,
				meta: {
					questionIndex: index,
					questionNumber: index + 1,
					toolCallId: toolResult.toolCallId,
				},
			});

			const toolFailure = readToolFailureMessage(toolResult.content);
			if (toolFailure) {
				toolFailureMessages.push(toolFailure);
			}
			const toolName =
				toolNamesById.get(toolResult.toolCallId) ?? "unknown_tool";
			if (isSuccessfulUpdateToolResult(toolName, toolResult.content)) {
				hasSuccessfulUpdate = true;
			}
		};
		const emitToolResult = createToolResultEmitter(
			handleToolResult,
			streamState,
		);

		const result = streamText({
			model: getAiModel(config),
			system: systemPrompt,
			messages: [{ role: "user", content: userPrompt }],
			tools: combinedTools,
			stopWhen: stepCountIs(10),
			providerOptions: buildProviderOptions(config),
		});

		for await (const chunk of result.fullStream) {
			if (isAiStreamRunErrorChunk(chunk)) {
				const message =
					chunk.error instanceof Error
						? chunk.error.message
						: String(chunk.error);
				throw new Error(`AI provider returned error: ${message}`);
			}

			processAiStreamPart(
				chunk,
				{
					onUsage: (usage) => {
						emitAgentEvent(options, {
							eventType: "token",
							stageId: "review",
							agentRunId,
							label,
							tokens: usage,
							meta: { questionIndex: index, questionNumber: index + 1 },
						});
					},
					onToolCall: handleToolCall,
					onToolResult: emitToolResult,
				},
				streamState,
			);
		}

		if (toolFailureMessages.length > 0 && !hasSuccessfulUpdate) {
			throw new Error(
				toolFailureMessages[0] ?? "Reviewer could not apply a valid review.",
			);
		}

		const reviewedQuestion = readReviewedQuestion(workspace);

		emitAgentEvent(options, {
			eventType: "result",
			stageId: "review",
			agentRunId,
			label,
			finalObject: reviewedQuestion,
			rawText: streamState.rawText,
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

function createReviewWorkspaceState(
	question: Question,
): Partial<ExtractionWorkspaceState> {
	const item: ExtractionWorkspaceQuestion = {
		questionId: "q1",
		question: question.question,
		options: [...question.options],
		answers: [...question.answers],
		scoringMode: question.scoringMode,
		explanation: "",
		topic: question.topic ?? "General",
		deepExplanation: question.deepExplanation,
	};

	return {
		questions: [item],
		nextQuestionNumber: 2,
	};
}

function readReviewedQuestion(
	workspace: ReturnType<typeof createExtractionWorkspace>,
): Question {
	const reviewed = workspace.listQuestions()[0];
	if (!reviewed) {
		throw new Error(
			"Reviewer finished without a question in the review workspace.",
		);
	}

	const { questionId: _questionId, ...question } = reviewed;
	return question;
}

function readToolFailureMessage(result: unknown): string | undefined {
	if (typeof result === "string") {
		try {
			return readToolFailureMessage(JSON.parse(result));
		} catch {
			return result.length > 0 ? result : undefined;
		}
	}
	if (typeof result !== "object" || result === null) return undefined;
	const errorValue = (result as { error?: unknown }).error;
	if (typeof errorValue === "string" && errorValue.length > 0) {
		return errorValue;
	}
	if (typeof errorValue !== "object" || errorValue === null) return undefined;
	return typeof (errorValue as { message?: unknown }).message === "string"
		? (errorValue as { message: string }).message
		: undefined;
}

function isSuccessfulUpdateToolResult(
	toolName: string,
	result: unknown,
): boolean {
	if (toolName !== "update_extracted_question") return false;
	if (typeof result !== "object" || result === null) return false;
	return (result as { ok?: unknown }).ok === true;
}
