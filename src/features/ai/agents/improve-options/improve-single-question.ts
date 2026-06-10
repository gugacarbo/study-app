import type { StreamChunk } from "@tanstack/ai";
import {
	createAgentStreamState,
	createToolResultEmitter,
	isAgentStreamRunErrorChunk,
	processAgentStreamChunk,
} from "@/features/ai/core/agent-stream-handler";
import { streamChatMessages } from "@/features/ai/core/chat-stream";
import {
	createImproveOptionsTools,
	createImproveOptionsWorkspace,
} from "@/features/ai/tools/improve-options-tools";
import type { ProviderConfig } from "@/lib/validation";
import {
	IMPROVE_OPTIONS_STAGE_ID,
	UPDATE_QUESTION_OPTIONS_TOOL,
	type DraftQuestion,
	type ImproveOptionsAgentRunSummary,
} from "./contracts";
import {
	emitAgentEvent,
	type ImproveSingleQuestionOptions,
} from "./execute-helpers";
import { buildUserPrompt } from "./prompt";
import { buildImproveOptionsSystemPrompt } from "./system-prompt";

export async function improveSingleQuestion(
	config: ProviderConfig,
	question: DraftQuestion,
	options: ImproveSingleQuestionOptions = {},
): Promise<
	| {
			question: DraftQuestion;
			agentRun: ImproveOptionsAgentRunSummary;
			success: true;
	  }
	| {
			question: DraftQuestion;
			agentRun: ImproveOptionsAgentRunSummary;
			success: false;
			reason: string;
	  }
> {
	const label = `Improve Options Q${question.id}`;
	const agentRunId =
		options.createAgentRunId?.(label) ?? `improve-options-${question.id}`;
	const systemPrompt = buildImproveOptionsSystemPrompt(question);
	const userPrompt = buildUserPrompt(question);
	const workspace = createImproveOptionsWorkspace({ questions: [question] });
	const workspaceTools = createImproveOptionsTools(workspace);
	const combinedTools = [
		...workspaceTools,
		...(options.tools ?? []),
	] as NonNullable<Parameters<typeof streamChatMessages>[2]>["tools"];
	const streamState = createAgentStreamState();
	const toolNamesById = new Map<string, string>();
	const toolFailureMessages: string[] = [];
	let hasSuccessfulUpdate = false;

	const baseMeta = { questionId: question.id };

	emitAgentEvent(options, {
		eventType: "lifecycle",
		stageId: IMPROVE_OPTIONS_STAGE_ID,
		agentRunId,
		label,
		status: "pending",
		systemPrompt,
		userPrompt,
		meta: baseMeta,
	});
	emitAgentEvent(options, {
		eventType: "lifecycle",
		stageId: IMPROVE_OPTIONS_STAGE_ID,
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
			if (toolCall.name) {
				toolNamesById.set(toolCall.toolCallId, toolCall.name);
			}
			emitAgentEvent(options, {
				eventType: "tool-call",
				stageId: IMPROVE_OPTIONS_STAGE_ID,
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

		const handleToolResult = (toolResult: {
			toolCallId: string;
			content?: unknown;
			error?: string;
			state: "streaming" | "complete" | "error";
		}) => {
			emitAgentEvent(options, {
				eventType: "tool-result",
				stageId: IMPROVE_OPTIONS_STAGE_ID,
				agentRunId,
				label,
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

			const toolName =
				toolNamesById.get(toolResult.toolCallId) ?? "unknown_tool";
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
		const emitToolResult = createToolResultEmitter(
			handleToolResult,
			streamState,
		);

		const stream = streamChatMessages(
			config,
			[{ role: "user", content: userPrompt }],
			{
				system: systemPrompt,
				tools: combinedTools,
				toolStreamHandlers: {
					onToolCall: handleToolCall,
					onToolResult: emitToolResult,
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
				chunk as StreamChunk,
				{
					onUsage: (usage) => {
						emitAgentEvent(options, {
							eventType: "token",
							stageId: IMPROVE_OPTIONS_STAGE_ID,
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
			stageId: IMPROVE_OPTIONS_STAGE_ID,
			agentRunId,
			label,
			finalObject: improvedQuestion,
			rawText: streamState.rawText,
			meta: baseMeta,
		});
		emitAgentEvent(options, {
			eventType: "lifecycle",
			stageId: IMPROVE_OPTIONS_STAGE_ID,
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
			`[${new Date().toISOString()} ERROR improve-options] ` +
				`Improve Q${question.id} failed: ${message}`,
			`question="${question.question.slice(0, 120)}..."`,
			`topic=${question.topic ?? "General"}`,
		);

		emitAgentEvent(options, {
			eventType: "lifecycle",
			stageId: IMPROVE_OPTIONS_STAGE_ID,
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
	summary: ImproveOptionsAgentRunSummary,
): ImproveOptionsAgentRunSummary {
	return summary;
}

function readImprovedQuestion(
	workspace: ReturnType<typeof createImproveOptionsWorkspace>,
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
