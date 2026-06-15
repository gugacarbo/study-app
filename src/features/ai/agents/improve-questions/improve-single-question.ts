import { stepCountIs, type ToolSet } from "ai";
import { buildProviderOptions } from "@/features/ai/adapters/provider-options";
import { getAiModel } from "@/features/ai/adapters/provider-model";
import {
	createAiStreamState,
	createToolResultEmitter,
	isAiStreamRunErrorChunk,
	payloadFromToolExecuteResult,
	processAiStreamPart,
} from "@/features/ai/core/ai-stream-handler";
import { loggedStreamText } from "@/features/ai/core/logged-stream-text";
import { createLlmLogContext } from "@/lib/llm-logging";
import {
	createImproveQuestionsTools,
	createImproveQuestionsWorkspace,
} from "@/features/ai/tools/improve-questions-tools";
import {
	type ProviderConfig,
	type ResolvedModelConfig,
	toProviderConfig,
} from "@/lib/validation";
import {
	IMPROVE_QUESTIONS_STAGE_ID,
	UPDATE_QUESTION_OPTIONS_TOOL,
	type DraftQuestion,
	type ImproveQuestionsAgentRunSummary,
	emitAgentEvent,
	type ImproveSingleQuestionOptions,
} from "./contracts";
import { buildUserPrompt } from "./prompt";
import { buildImproveQuestionsSystemPrompt } from "./system-prompt";

export async function improveSingleQuestion(
	config: ProviderConfig | ResolvedModelConfig,
	question: DraftQuestion,
	options: ImproveSingleQuestionOptions = {},
): Promise<
	| {
			question: DraftQuestion;
			agentRun: ImproveQuestionsAgentRunSummary;
			success: true;
	  }
	| {
			question: DraftQuestion;
			agentRun: ImproveQuestionsAgentRunSummary;
			success: false;
			reason: string;
	  }
> {
	const label = `Improve Question Q${question.id}`;
	const agentRunId =
		options.createAgentRunId?.(label) ?? `improve-questions-${question.id}`;
	const isFollowUp = options.followUp != null;
	const followUp = options.followUp;
	const systemPrompt = buildImproveQuestionsSystemPrompt(question);
	const userPrompt = followUp?.message ?? buildUserPrompt(question);
	const workspace = createImproveQuestionsWorkspace({ questions: [question] });
	const streamState = createAiStreamState();
	const toolNamesById = new Map<string, string>();
	const toolFailureMessages: string[] = [];
	let hasSuccessfulUpdate = false;

	const baseMeta = { questionId: question.id };
	const providerConfig = toProviderConfig(config);

	const handleToolResult = (toolResult: {
		toolCallId: string;
		content?: unknown;
		error?: string;
		state: "streaming" | "complete" | "error";
	}) => {
		const toolName =
			toolNamesById.get(toolResult.toolCallId) ?? "unknown_tool";
		emitAgentEvent(options, {
			eventType: "tool-result",
			stageId: IMPROVE_QUESTIONS_STAGE_ID,
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
			const content = toolResult.content as {
				ok: true;
				id: number;
				updatedFields: string[];
			};
			options.onWorkspaceUpdate?.({
				question: workspace.getQuestion(content.id),
				updatedFields: content.updatedFields,
			});
		}
	};
	const emitToolResult = createToolResultEmitter(handleToolResult, streamState);

	const workspaceTools = createImproveQuestionsTools(workspace, {
		onToolExecuted: async ({ toolCallId, toolName, output }) => {
			toolNamesById.set(toolCallId, toolName);
			emitToolResult(payloadFromToolExecuteResult(toolCallId, output));
		},
	});
	const combinedTools: ToolSet = {
		...workspaceTools,
		...(options.tools ?? {}),
	};

	emitAgentEvent(options, {
		eventType: "lifecycle",
		stageId: IMPROVE_QUESTIONS_STAGE_ID,
		agentRunId,
		label,
		status: "pending",
		...(isFollowUp
			? {}
			: {
					systemPrompt,
					userPrompt,
				}),
		meta: baseMeta,
	});
	emitAgentEvent(options, {
		eventType: "lifecycle",
		stageId: IMPROVE_QUESTIONS_STAGE_ID,
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
			emitAgentEvent(options, {
				eventType: "tool-call",
				stageId: IMPROVE_QUESTIONS_STAGE_ID,
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

		const conversationMessages = followUp
			? [
					...followUp.history.map((entry) => ({
						role: entry.role,
						content: entry.content,
					})),
					{ role: "user" as const, content: followUp.message },
				]
			: [{ role: "user" as const, content: userPrompt }];

		const result = loggedStreamText(
			createLlmLogContext("improve-questions", providerConfig, {
				callId: agentRunId,
				systemPrompt,
				requestSummary: isFollowUp
					? `questionId=${question.id} followUp`
					: `questionId=${question.id}`,
				metadata: baseMeta,
			}),
			{
				model: getAiModel(providerConfig),
				system: systemPrompt,
				messages: conversationMessages,
				tools: combinedTools,
				stopWhen: stepCountIs(10),
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
						emitAgentEvent(options, {
							eventType: "token",
							stageId: IMPROVE_QUESTIONS_STAGE_ID,
							agentRunId,
							label,
							rawText: delta,
							meta: baseMeta,
						});
					},
					onReasoningDelta: (delta) => {
						emitAgentEvent(options, {
							eventType: "token",
							stageId: IMPROVE_QUESTIONS_STAGE_ID,
							agentRunId,
							label,
							rawText: delta,
							meta: { ...baseMeta, kind: "reasoning" },
						});
					},
					onUsage: (usage) => {
						emitAgentEvent(options, {
							eventType: "token",
							stageId: IMPROVE_QUESTIONS_STAGE_ID,
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
					"Improve-options agent could not apply a valid update.",
			);
		}

		const improvedQuestion = readImprovedQuestion(workspace, question.id);

		emitAgentEvent(options, {
			eventType: "result",
			stageId: IMPROVE_QUESTIONS_STAGE_ID,
			agentRunId,
			label,
			finalObject: improvedQuestion,
			rawText: streamState.rawText,
			meta: baseMeta,
		});
		emitAgentEvent(options, {
			eventType: "lifecycle",
			stageId: IMPROVE_QUESTIONS_STAGE_ID,
			agentRunId,
			label,
			status: "done",
			meta: baseMeta,
		});

		return {
			question: improvedQuestion,
			agentRun: buildAgentRunSummary({
				agentRunId,
				label,
				status: "done",
				systemPrompt,
				userPrompt,
				rawText: streamState.rawText,
				finalObject: improvedQuestion,
				meta: baseMeta,
			}),
			success: true,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		console.error(
			`[${new Date().toISOString()} ERROR improve-questions] ` +
				`Improve Q${question.id} failed: ${message}`,
			`question="${question.question.slice(0, 120)}..."`,
			`topic=${question.topic ?? "General"}`,
		);

		emitAgentEvent(options, {
			eventType: "lifecycle",
			stageId: IMPROVE_QUESTIONS_STAGE_ID,
			agentRunId,
			label,
			status: "error",
			error: message,
			meta: baseMeta,
		});

		return {
			question,
			agentRun: buildAgentRunSummary({
				agentRunId,
				label,
				status: "error",
				systemPrompt,
				userPrompt,
				rawText: streamState.rawText,
				error: message,
				meta: baseMeta,
			}),
			success: false,
			reason: message,
		};
	}
}

function buildAgentRunSummary(
	summary: ImproveQuestionsAgentRunSummary,
): ImproveQuestionsAgentRunSummary {
	return summary;
}

function readImprovedQuestion(
	workspace: ReturnType<typeof createImproveQuestionsWorkspace>,
	questionId: number,
): DraftQuestion {
	const improved = workspace.getQuestion(questionId);
	return improved;
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
	if (toolName !== UPDATE_QUESTION_OPTIONS_TOOL) return false;
	if (typeof result !== "object" || result === null) return false;
	return (result as { ok?: unknown }).ok === true;
}
