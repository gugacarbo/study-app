import type { StreamChunk } from "@tanstack/ai";
import { buildSystemPrompt } from "@/features/ai/agents/ingest/system-prompt";
import {
	createAgentStreamState,
	isAgentStreamRunErrorChunk,
	processAgentStreamChunk,
} from "@/features/ai/core/agent-stream-handler";
import { streamChatMessages } from "@/features/ai/core/chat-stream";
import {
	createExtractionWorkspace,
	createIngestExtractionTools,
} from "@/features/ai/tools/ingest-tools";
import type { ExamIngestResponse, ProviderConfig } from "@/lib/validation";
import { buildExtractionUserPrompt } from "./-extract-text";
import type { AgentRunDescriptor, AgentRunStatus } from "./-sse-emitter";

interface ExtractionPassParams {
	text: string;
	config: ProviderConfig;
	criticalTopics: string[];
	agentRuns: {
		createRun(stageId: string, label: string): AgentRunDescriptor;
		lifecycle(
			run: AgentRunDescriptor,
			status: AgentRunStatus,
			meta?: Record<string, unknown>,
		): void;
		result(
			run: AgentRunDescriptor,
			finalObject: unknown,
			rawText?: string,
			meta?: Record<string, unknown>,
		): void;
		token(
			run: AgentRunDescriptor,
			tokens: unknown,
			meta?: Record<string, unknown>,
		): void;
		toolCall(
			run: AgentRunDescriptor,
			tool: {
				name?: string;
				arguments?: string;
				input?: unknown;
				output?: unknown;
				state?: string;
			},
			meta?: Record<string, unknown>,
		): void;
		toolResult(
			run: AgentRunDescriptor,
			result: {
				content?: unknown;
				error?: string;
				state?: string;
			},
			meta?: Record<string, unknown>,
		): void;
	};
	send: (event: string, data: unknown) => void;
	log: {
		error: (msg: string, err: unknown, ctx?: Record<string, unknown>) => void;
	};
	stageId: string;
	stageLabel: string;
}

export async function runExtractionPass(
	params: ExtractionPassParams,
): Promise<ExamIngestResponse> {
	const {
		text,
		config,
		criticalTopics,
		agentRuns,
		send,
		log,
		stageId,
		stageLabel,
	} = params;

	const systemPrompt = buildSystemPrompt({
		criticalTopics,
		enableWebVerification: false,
	});
	const userPrompt = buildExtractionUserPrompt(text);
	const run = agentRuns.createRun(stageId, stageLabel);
	const workspace = createExtractionWorkspace();
	const tools = createIngestExtractionTools(workspace);
	const streamState = createAgentStreamState();

	agentRuns.lifecycle(run, "pending", { systemPrompt, userPrompt });
	agentRuns.lifecycle(run, "running");

	try {
		const stream = streamChatMessages(
			config,
			[{ role: "user", content: userPrompt }],
			{
				system: systemPrompt,
				tools: [...tools] as unknown as NonNullable<
					Parameters<typeof streamChatMessages>[2]
				>["tools"],
				toolStreamHandlers: {
					onToolCall: (toolCall) => {
						agentRuns.toolCall(
							run,
							{
								name: toolCall.name,
								arguments: toolCall.arguments,
								input: toolCall.input,
								state: toolCall.state,
							},
							{ toolCallId: toolCall.toolCallId },
						);
					},
					onToolResult: (toolResult) => {
						agentRuns.toolResult(
							run,
							{
								content: toolResult.content,
								error: toolResult.error,
								state: toolResult.state,
							},
							{ toolCallId: toolResult.toolCallId },
						);
					},
				},
			},
		);

		for await (const chunk of stream) {
			if (isAgentStreamRunErrorChunk(chunk)) {
				log.error("AI extraction pass run error", chunk, {
					stage: stageId,
					agentRunId: run.agentRunId,
					label: stageLabel,
					toolCallId:
						"toolCallId" in chunk && typeof chunk.toolCallId === "string"
							? chunk.toolCallId
							: undefined,
					rawTextLength: streamState.rawText.length,
				});
				throw new Error(
					`AI provider returned error: ${chunk.message}${chunk.code ? ` (code: ${chunk.code})` : ""}`,
				);
			}

			processAgentStreamChunk(
				chunk as StreamChunk,
				{
					onTextDelta: (delta) => {
						send("chunk", {
							stageId: run.stageId,
							agentRunId: run.agentRunId,
							text: delta,
							kind: "text",
						});
					},
					onReasoningDelta: (delta) => {
						send("chunk", {
							stageId: run.stageId,
							agentRunId: run.agentRunId,
							text: delta,
							kind: "reasoning",
						});
					},
					onUsage: (usage) => {
						send("token", {
							stageId: run.stageId,
							agentRunId: run.agentRunId,
							usage,
						});
						agentRuns.token(run, usage);
					},
					onToolCall: (toolCall) => {
						agentRuns.toolCall(
							run,
							{
								name: toolCall.name,
								arguments: toolCall.arguments,
								input: toolCall.input,
								state: toolCall.state,
							},
							{ toolCallId: toolCall.toolCallId },
						);
					},
					onToolResult: (toolResult) => {
						agentRuns.toolResult(
							run,
							{
								content: toolResult.content,
								error: toolResult.error,
								state: toolResult.state,
							},
							{ toolCallId: toolResult.toolCallId },
						);
					},
				},
				streamState,
			);
		}

		const result = workspace.buildResult();
		if (result.questions.length === 0) {
			const message =
				"No questions were extracted during the initial ingest pass.";
			send("warning", {
				message,
			});
			throw new Error(message);
		}

		agentRuns.result(run, result, streamState.rawText, {
			toolQuestionCount: workspace.listQuestions().length,
		});
		agentRuns.lifecycle(run, "done", {
			meta: {
				questionCount: result.questions.length,
				topicCount: result.topics.length,
			},
		});
		return result;
	} catch (error) {
		log.error("AI extraction pass failed", error, {
			stage: stageId,
			agentRunId: run.agentRunId,
			label: stageLabel,
			rawTextLength: streamState.rawText.length,
			rawTextPreview:
				streamState.rawText.length > 1000
					? `${streamState.rawText.slice(0, 1000)}...`
					: streamState.rawText,
			systemPrompt,
			userPromptPreview:
				userPrompt.length > 500 ? `${userPrompt.slice(0, 500)}...` : userPrompt,
		});
		agentRuns.lifecycle(run, "error", {
			error: error instanceof Error ? error.message : "unknown error",
			rawText: streamState.rawText,
		});
		throw error;
	}
}
