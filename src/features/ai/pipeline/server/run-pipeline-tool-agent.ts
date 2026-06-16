import type { PrepareStepFunction, StopCondition, ToolSet } from "ai";
import {
	type AiStreamState,
	createAiStreamState,
	createToolResultEmitter,
} from "@/features/ai/core/ai-stream-handler";
import {
	readToolFailureMessage,
	runToolAgentStream,
} from "@/features/ai/core/tool-agent-run";
import type { AgentRunDescriptor } from "@/features/ai/core/ui-message-job-stream";
import type { AgentEventEmitter } from "@/features/ai/pipeline/types";
import type { AgentRunDataPart } from "@/features/ai/types/ui-message-data-parts";
import type { ProviderConfig } from "@/lib/validation";

export interface PipelineToolAgentResult {
	success: boolean;
	reason?: string;
	rawText: string;
	streamState: AiStreamState;
	toolFailureMessages: string[];
}

export interface RunPipelineToolAgentParams {
	scope: string;
	stageId: string;
	config: ProviderConfig;
	run: AgentRunDescriptor;
	emit: AgentEventEmitter;
	systemPrompt: string;
	messages: Array<{ role: "user" | "assistant"; content: string }>;
	tools: ToolSet;
	stopWhen:
		| StopCondition<NoInfer<ToolSet>>
		| Array<StopCondition<NoInfer<ToolSet>>>;
	prepareStep?: PrepareStepFunction<NoInfer<ToolSet>>;
	meta?: Record<string, unknown>;
	requestSummary?: string;
	includePromptsInPending?: boolean;
	onRecoverableError?: (message: string) => void;
	isSuccess: (ctx: {
		streamState: AiStreamState;
		toolFailureMessages: string[];
	}) => boolean;
	failureReason?: (ctx: {
		streamState: AiStreamState;
		toolFailureMessages: string[];
	}) => string | undefined;
}

function mergeMeta(
	base: Record<string, unknown> | undefined,
	extra: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!base && !extra) return undefined;
	return { ...base, ...extra };
}

type AgentRunEventPayload = Omit<
	AgentRunDataPart,
	"timestamp" | "stageId" | "agentRunId" | "label"
>;

function emitRunEvent(
	emit: AgentEventEmitter,
	run: AgentRunDescriptor,
	event: AgentRunEventPayload,
	meta?: Record<string, unknown>,
): void {
	emit({
		...event,
		stageId: run.stageId,
		agentRunId: run.agentRunId,
		label: run.label,
		meta: mergeMeta(meta, event.meta),
	});
}

function resolveUserPrompt(
	messages: RunPipelineToolAgentParams["messages"],
): string | undefined {
	const userMessages = messages.filter((message) => message.role === "user");
	if (userMessages.length === 0) return undefined;
	return userMessages[userMessages.length - 1]?.content;
}

function shouldIncludePromptsInPending(
	messages: RunPipelineToolAgentParams["messages"],
	includePromptsInPending: boolean | undefined,
): boolean {
	if (includePromptsInPending != null) return includePromptsInPending;
	return messages.length === 1 && messages[0]?.role === "user";
}

export async function runPipelineToolAgent(
	params: RunPipelineToolAgentParams,
): Promise<PipelineToolAgentResult> {
	const streamState = createAiStreamState();
	const toolFailureMessages: string[] = [];
	const toolNamesById = new Map<string, string>();
	const { run, emit, meta } = params;
	const userPrompt = resolveUserPrompt(params.messages);

	emitRunEvent(
		emit,
		run,
		{
			eventType: "lifecycle",
			status: "pending",
			...(shouldIncludePromptsInPending(
				params.messages,
				params.includePromptsInPending,
			)
				? {
						systemPrompt: params.systemPrompt,
						userPrompt,
					}
				: {}),
		},
		meta,
	);
	emitRunEvent(emit, run, { eventType: "lifecycle", status: "running" }, meta);

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

		emitRunEvent(
			emit,
			run,
			{
				eventType: "tool-call",
				name: toolCall.name,
				arguments: toolCall.arguments,
				input: toolCall.input,
				state: toolCall.state,
				meta: { toolCallId: toolCall.toolCallId },
			},
			meta,
		);
	};

	const handleToolResult = (toolResult: {
		toolCallId: string;
		content?: unknown;
		error?: string;
		state: "streaming" | "complete" | "error";
	}) => {
		const toolName = toolNamesById.get(toolResult.toolCallId) ?? "unknown_tool";

		emitRunEvent(
			emit,
			run,
			{
				eventType: "tool-result",
				name: toolName,
				content: toolResult.content,
				error: toolResult.error,
				state: toolResult.state,
				meta: { toolCallId: toolResult.toolCallId },
			},
			meta,
		);

		const toolFailure = readToolFailureMessage(toolResult.content);
		if (toolFailure) {
			toolFailureMessages.push(toolFailure);
		}
	};

	const emitToolResult = createToolResultEmitter(handleToolResult, streamState);

	try {
		await runToolAgentStream({
			scope: params.scope,
			config: params.config,
			callId: run.agentRunId,
			requestSummary: params.requestSummary ?? run.label,
			metadata: params.meta,
			systemPrompt: params.systemPrompt,
			messages: params.messages,
			tools: params.tools,
			stopWhen: params.stopWhen,
			prepareStep: params.prepareStep,
			streamState,
			onRecoverableError: (message) => {
				params.onRecoverableError?.(message);
				emitRunEvent(
					emit,
					run,
					{
						eventType: "warning",
						warning: message,
					},
					meta,
				);
			},
			handlers: {
				onTextDelta: (delta) => {
					emitRunEvent(emit, run, { eventType: "token", rawText: delta }, meta);
				},
				onReasoningDelta: (delta) => {
					emitRunEvent(
						emit,
						run,
						{
							eventType: "token",
							rawText: delta,
							meta: { kind: "reasoning" },
						},
						meta,
					);
				},
				onUsage: (usage) => {
					emitRunEvent(emit, run, { eventType: "token", tokens: usage }, meta);
				},
				onToolCall: handleToolCall,
				onToolResult: emitToolResult,
			},
		});

		const successContext = { streamState, toolFailureMessages };
		if (!params.isSuccess(successContext)) {
			const reason =
				params.failureReason?.(successContext) ??
				toolFailureMessages[0] ??
				"Agent run did not meet success criteria.";

			emitRunEvent(
				emit,
				run,
				{ eventType: "lifecycle", status: "error", error: reason },
				meta,
			);

			return {
				success: false,
				reason,
				rawText: streamState.rawText,
				streamState,
				toolFailureMessages,
			};
		}

		emitRunEvent(emit, run, { eventType: "lifecycle", status: "done" }, meta);

		return {
			success: true,
			rawText: streamState.rawText,
			streamState,
			toolFailureMessages,
		};
	} catch (error) {
		const reason = error instanceof Error ? error.message : "unknown error";

		emitRunEvent(
			emit,
			run,
			{ eventType: "lifecycle", status: "error", error: reason },
			meta,
		);

		return {
			success: false,
			reason,
			rawText: streamState.rawText,
			streamState,
			toolFailureMessages,
		};
	}
}
