import {
	createAgentStreamState,
	isAgentStreamRunErrorChunk,
	processAgentStreamChunk,
} from "@/features/ai/core/agent-stream-handler";
import { streamChatMessages } from "@/features/ai/core/chat-stream";
import {
	createExplanationTools,
	createExplanationWorkspace,
} from "@/features/ai/tools/explanation-tools";
import type { ProviderConfig } from "@/lib/validation";
import { buildSystemPrompt } from "../system-prompt";
import { emitAgentEvent } from "./execute-helpers";
import { buildExplanationUserPrompt } from "./prompt";
import type {
	ExplanationBatchInput,
	ExplanationQuestionResult,
	RunQuestionExplanationsOptions,
} from "./types";

export async function explainSingleQuestion(
	config: ProviderConfig,
	question: ExplanationBatchInput,
	index: number,
	totalQuestions: number,
	options: RunQuestionExplanationsOptions,
): Promise<
	| { result: ExplanationQuestionResult; success: true }
	| { question: ExplanationBatchInput; success: false; reason: string }
> {
	const label = `Explanation Q${index + 1}`;
	const agentRunId =
		options.createAgentRunId?.(label) ?? `explanation-question-${index + 1}`;
	const memoryContext =
		options.resolveMemoryContext?.(question) ?? options.memoryContext;
	const systemPrompt = buildSystemPrompt(memoryContext);
	const userPrompt = buildExplanationUserPrompt(question, index);
	const workspace = createExplanationWorkspace([question]);
	const explanationTools = createExplanationTools(workspace);
	const combinedTools = {
		...explanationTools,
		...((options.tools as Record<string, unknown> | undefined) ?? {}),
	} as unknown as NonNullable<Parameters<typeof streamChatMessages>[2]>["tools"];
	const streamState = createAgentStreamState();
	const toolNamesById = new Map<string, string>();
	const toolFailureMessages: string[] = [];
	let hasSuccessfulUpdate = false;

	emitAgentEvent(options, {
		eventType: "lifecycle",
		stageId: "explanations",
		agentRunId,
		label,
		status: "pending",
		systemPrompt,
		userPrompt,
		meta: {
			questionIndex: index,
			questionNumber: index + 1,
			questionCount: 1,
			questionIds: [question.id],
			topic: question.topic ?? "General",
		},
	});
	emitAgentEvent(options, {
		eventType: "lifecycle",
		stageId: "explanations",
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
			if (toolCall.name) {
				toolNamesById.set(toolCall.toolCallId, toolCall.name);
			}
			emitAgentEvent(options, {
				eventType: "tool-call",
				stageId: "explanations",
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
				stageId: "explanations",
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

		const stream = streamChatMessages(
			config,
			[{ role: "user", content: userPrompt }],
			{
				system: systemPrompt,
				tools: combinedTools,
				toolStreamHandlers: {
					onToolCall: handleToolCall,
					onToolResult: handleToolResult,
				},
				streamState,
			},
		);

		for await (const chunk of stream) {
			if (isAgentStreamRunErrorChunk(chunk)) {
				throw new Error(
					`AI provider returned error: ${chunk.message}${chunk.code ? ` (code: ${chunk.code})` : ""}`,
				);
			}

			processAgentStreamChunk(
				chunk as Parameters<typeof processAgentStreamChunk>[0],
				{
					onUsage: (usage) => {
						emitAgentEvent(options, {
							eventType: "token",
							stageId: "explanations",
							agentRunId,
							label,
							tokens: usage,
							meta: { questionIndex: index, questionNumber: index + 1 },
						});
					},
					onToolCall: handleToolCall,
					onToolResult: handleToolResult,
				},
				streamState,
			);
		}

		if (toolFailureMessages.length > 0 && !hasSuccessfulUpdate) {
			throw new Error(
				toolFailureMessages[0] ??
					"Explanation agent could not apply a valid explanation update.",
			);
		}

		const generated = readGeneratedExplanation(workspace, question.id);

		emitAgentEvent(options, {
			eventType: "result",
			stageId: "explanations",
			agentRunId,
			label,
			finalObject: generated,
			rawText: streamState.rawText,
			meta: { questionIndex: index, questionNumber: index + 1 },
		});
		emitAgentEvent(options, {
			eventType: "lifecycle",
			stageId: "explanations",
			agentRunId,
			label,
			status: "done",
			meta: { questionIndex: index, questionNumber: index + 1 },
		});

		return { result: generated, success: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		console.error(
			`[${new Date().toISOString()} ERROR generate-explanations] ` +
				`Explanation Q${index + 1}/${totalQuestions} failed: ${message}`,
			`question="${question.question.slice(0, 120)}..."`,
			`topic=${question.topic ?? "General"}`,
		);

		emitAgentEvent(options, {
			eventType: "lifecycle",
			stageId: "explanations",
			agentRunId,
			label,
			status: "error",
			error: message,
			meta: { questionIndex: index, questionNumber: index + 1 },
		});
		emitAgentEvent(options, {
			eventType: "warning",
			stageId: "explanations",
			agentRunId,
			label,
			warning: `Explanation generation failed for question #${index + 1}. Keeping the original question.`,
			meta: { questionIndex: index, questionNumber: index + 1 },
		});

		return { question, success: false, reason: message };
	}
}

function readGeneratedExplanation(
	workspace: ReturnType<typeof createExplanationWorkspace>,
	questionId: number,
): ExplanationQuestionResult {
	const built = workspace.buildResult();
	const generated = built.questions.find((item) => item.id === questionId);
	if (!generated) {
		throw new Error(
			"Explanation agent finished without an explanation in the workspace.",
		);
	}

	return generated;
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
	if (toolName !== "update_question_explanation") return false;
	if (typeof result !== "object" || result === null) return false;
	return (result as { ok?: unknown }).ok === true;
}
