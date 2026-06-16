import type { ToolSet } from "ai";
import { buildProviderOptions } from "@/features/ai/adapters/provider-options";
import { getAiModel } from "@/features/ai/adapters/provider-model";
import { INGEST_PER_QUESTION_MAX_STEPS } from "@/features/ai/core/agent-limits";
import {
	createAiStreamState,
	createToolResultEmitter,
	isAiStreamRunErrorChunk,
	payloadFromToolExecuteResult,
	processAiStreamPart,
} from "@/features/ai/core/ai-stream-handler";
import { loggedStreamText } from "@/features/ai/core/logged-stream-text";
import {
	buildIngestExplanationStopWhen,
	buildPostUpdatePrepareStep,
} from "@/features/ai/core/tool-agent-stop-when";
import {
	createExplanationTools,
	createExplanationWorkspace,
} from "@/features/ai/tools/explanation-tools";
import { createLlmLogContext } from "@/lib/llm-logging";
import type { ProviderConfig, ResolvedModelConfig } from "@/lib/validation";
import { toProviderConfig } from "@/lib/validation";
import type { ExplanationBatchInput } from "../generate-explanations/types";
import {
	EXPLAIN_QUESTION_AGENT_STAGE_ID,
	UPDATE_QUESTION_EXPLANATION_TOOL,
	emitExplainQuestionAgentEvent,
	type ExplainQuestionByIdOptions,
} from "./contracts";
import { buildExplainQuestionUserPrompt } from "./prompt";
import { buildExplainQuestionSystemPrompt } from "./system-prompt";

export async function explainQuestionById(
	config: ProviderConfig | ResolvedModelConfig,
	question: ExplanationBatchInput & { deepExplanation?: string },
	options: ExplainQuestionByIdOptions = {},
): Promise<
	| {
			result: {
				questionId: number;
				explanation: string;
				deepExplanation: string;
			};
			success: true;
	  }
	| { questionId: number; success: false; reason: string }
> {
	const questionId = question.id;
	const label = `Explanation Q${questionId}`;
	const agentRunId =
		options.createAgentRunId?.(label) ?? `explain-question-${questionId}`;
	const memoryContext = options.resolveMemoryContext?.();
	const systemPrompt = buildExplainQuestionSystemPrompt(questionId, memoryContext);
	const userPrompt = buildExplainQuestionUserPrompt(questionId, {
		overwrite: options.overwrite,
	});
	const workspace = createExplanationWorkspace([question]);
	const streamState = createAiStreamState();
	const toolNamesById = new Map<string, string>();
	const toolFailureMessages: string[] = [];
	let hasSuccessfulUpdate = false;
	let toolsComplete = false;
	const baseMeta = { questionId };
	const providerConfig = toProviderConfig(config);

	const handleToolResult = (toolResult: {
		toolCallId: string;
		content?: unknown;
		error?: string;
		state: "streaming" | "complete" | "error";
	}) => {
		const toolName =
			toolNamesById.get(toolResult.toolCallId) ?? "unknown_tool";
		emitExplainQuestionAgentEvent(options, {
			eventType: "tool-result",
			stageId: EXPLAIN_QUESTION_AGENT_STAGE_ID,
			agentRunId,
			label,
			name: toolName,
			content: toolResult.content,
			error: toolResult.error,
			state: toolResult.state,
			meta: {
				...baseMeta,
				toolCallId: toolResult.toolCallId,
			},
		});

		const toolFailure = readToolFailureMessage(toolResult.content);
		if (toolFailure) {
			toolFailureMessages.push(toolFailure);
		}

		if (isSuccessfulUpdateToolResult(toolName, toolResult.content)) {
			hasSuccessfulUpdate = true;
			toolsComplete = true;
			const content = toolResult.content as {
				ok: true;
				questionId: number;
				updatedFields: readonly ["explanation", "deepExplanation"];
			};
			const updated = workspace
				.listQuestions()
				.find((item) => item.id === content.questionId);
			if (updated) {
				options.onWorkspaceUpdate?.({
					questionId: content.questionId,
					explanation: updated.explanation,
					deepExplanation: updated.deepExplanation,
					updatedFields: [...content.updatedFields],
				});
			}
		}
	};
	const emitToolResult = createToolResultEmitter(handleToolResult, streamState);

	const explanationTools = createExplanationTools(workspace, {
		onToolExecuted: async ({ toolCallId, toolName, output }) => {
			toolNamesById.set(toolCallId, toolName);
			emitToolResult(payloadFromToolExecuteResult(toolCallId, output));
		},
	});
	const combinedTools: ToolSet = {
		...explanationTools,
		...(options.tools ?? {}),
	};

	emitExplainQuestionAgentEvent(options, {
		eventType: "lifecycle",
		stageId: EXPLAIN_QUESTION_AGENT_STAGE_ID,
		agentRunId,
		label,
		status: "pending",
		systemPrompt,
		userPrompt,
		meta: baseMeta,
	});
	emitExplainQuestionAgentEvent(options, {
		eventType: "lifecycle",
		stageId: EXPLAIN_QUESTION_AGENT_STAGE_ID,
		agentRunId,
		label,
		status: "running",
		meta: baseMeta,
	});

	try {
		const handleToolCall = (toolCall: {
			toolCallId: string;
			name?: string;
			arguments?: string;
			input?: unknown;
			state: "awaiting-input" | "input-streaming" | "input-complete";
		}) => {
			if (
				toolCall.state === "input-streaming" ||
				toolCall.state === "awaiting-input"
			) {
				if (toolCall.name) {
					toolNamesById.set(toolCall.toolCallId, toolCall.name);
				}
				return;
			}

			if (toolCall.name) {
				toolNamesById.set(toolCall.toolCallId, toolCall.name);
			}
			emitExplainQuestionAgentEvent(options, {
				eventType: "tool-call",
				stageId: EXPLAIN_QUESTION_AGENT_STAGE_ID,
				agentRunId,
				label,
				name: toolCall.name,
				arguments: toolCall.arguments,
				input: toolCall.input,
				state: toolCall.state,
				meta: {
					...baseMeta,
					toolCallId: toolCall.toolCallId,
				},
			});
		};

		const result = loggedStreamText(
			createLlmLogContext("explain-question", providerConfig, {
				callId: agentRunId,
				systemPrompt,
				requestSummary: `questionId=${questionId}`,
				metadata: baseMeta,
			}),
			{
				model: getAiModel(providerConfig),
				system: systemPrompt,
				messages: [{ role: "user", content: userPrompt }],
				tools: combinedTools,
				stopWhen: buildIngestExplanationStopWhen(INGEST_PER_QUESTION_MAX_STEPS),
				prepareStep: buildPostUpdatePrepareStep(() => toolsComplete),
				providerOptions: buildProviderOptions(providerConfig),
			},
		);

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
					onTextDelta: (delta) => {
						emitExplainQuestionAgentEvent(options, {
							eventType: "token",
							stageId: EXPLAIN_QUESTION_AGENT_STAGE_ID,
							agentRunId,
							label,
							rawText: delta,
							meta: baseMeta,
						});
					},
					onReasoningDelta: (delta) => {
						emitExplainQuestionAgentEvent(options, {
							eventType: "token",
							stageId: EXPLAIN_QUESTION_AGENT_STAGE_ID,
							agentRunId,
							label,
							rawText: delta,
							meta: { ...baseMeta, kind: "reasoning" },
						});
					},
					onUsage: (usage) => {
						emitExplainQuestionAgentEvent(options, {
							eventType: "token",
							stageId: EXPLAIN_QUESTION_AGENT_STAGE_ID,
							agentRunId,
							label,
							tokens: usage,
							meta: baseMeta,
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
				toolFailureMessages[0] ??
					"Explanation agent could not apply a valid explanation update.",
			);
		}

		if (!hasSuccessfulUpdate) {
			throw new Error(
				"Explanation agent finished without calling update_question_explanation.",
			);
		}

		const generated = readGeneratedExplanation(workspace, questionId);

		emitExplainQuestionAgentEvent(options, {
			eventType: "result",
			stageId: EXPLAIN_QUESTION_AGENT_STAGE_ID,
			agentRunId,
			label,
			finalObject: generated,
			rawText: streamState.rawText,
			meta: baseMeta,
		});
		emitExplainQuestionAgentEvent(options, {
			eventType: "lifecycle",
			stageId: EXPLAIN_QUESTION_AGENT_STAGE_ID,
			agentRunId,
			label,
			status: "done",
			meta: baseMeta,
		});

		return {
			result: {
				questionId,
				explanation: generated.explanation,
				deepExplanation: generated.deepExplanation,
			},
			success: true,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		console.error(
			`[${new Date().toISOString()} ERROR explain-question] ` +
				`Explanation Q${questionId} failed: ${message}`,
		);

		emitExplainQuestionAgentEvent(options, {
			eventType: "lifecycle",
			stageId: EXPLAIN_QUESTION_AGENT_STAGE_ID,
			agentRunId,
			label,
			status: "error",
			error: message,
			meta: baseMeta,
		});

		return { questionId, success: false, reason: message };
	}
}

function readGeneratedExplanation(
	workspace: ReturnType<typeof createExplanationWorkspace>,
	questionId: number,
) {
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
	if (toolName !== UPDATE_QUESTION_EXPLANATION_TOOL) return false;
	if (typeof result !== "object" || result === null) return false;
	return (result as { ok?: unknown }).ok === true;
}
