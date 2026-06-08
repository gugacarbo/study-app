import type { StreamChunk } from "@tanstack/ai";
import { buildSystemPrompt } from "@/features/ai/agents/ingest/system-prompt";
import { streamChatMessages } from "@/features/ai/core/chat-stream";
import {
	createExtractionWorkspace,
	createIngestExtractionTools,
} from "@/features/ai/tools/ingest-tools";
import type { ExamIngestResponse, ProviderConfig } from "@/lib/validation";
import { buildExtractionUserPrompt } from "./-extract-text";
import type { AgentRunDescriptor, AgentRunStatus } from "./-sse-emitter";
import { isTextChunk } from "./-sse-emitter";

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
				state?: "complete";
			},
			meta?: Record<string, unknown>,
		): void;
		toolResult(
			run: AgentRunDescriptor,
			result: {
				content?: unknown;
				error?: string;
				state?: "complete" | "error";
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
	let rawText = "";

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
			},
		);

		for await (const chunk of stream) {
			if (isTextChunk(chunk) && chunk.delta) {
				rawText += chunk.delta;
				send("chunk", {
					stageId: run.stageId,
					agentRunId: run.agentRunId,
					text: chunk.delta,
				});
			}

			if ("usage" in chunk && chunk.usage) {
				send("token", {
					stageId: run.stageId,
					agentRunId: run.agentRunId,
					usage: chunk.usage,
				});
				agentRuns.token(run, chunk.usage);
			}

			if (isRunErrorChunk(chunk)) {
				log.error("AI extraction pass run error", chunk, {
					stage: stageId,
					agentRunId: run.agentRunId,
					label: stageLabel,
					toolCallId:
						"toolCallId" in chunk && typeof chunk.toolCallId === "string"
							? chunk.toolCallId
							: undefined,
					rawTextLength: rawText.length,
				});
				throw new Error(
					`AI provider returned error: ${chunk.message}${chunk.code ? ` (code: ${chunk.code})` : ""}`,
				);
			}

			if (isToolCallEndChunk(chunk)) {
				const toolMeta = {
					toolCallId:
						typeof chunk.toolCallId === "string" ? chunk.toolCallId : undefined,
				};
				const toolEvent = buildToolEvent(chunk);
				agentRuns.toolCall(
					run,
					{
						name: toolEvent.name,
						arguments: toolEvent.arguments,
						input: toolEvent.input,
						output: toolEvent.output,
						state: "complete",
					},
					toolMeta,
				);
				agentRuns.toolResult(
					run,
					{
						content: toolEvent.resultContent,
						error: toolEvent.resultError,
						state: toolEvent.resultError ? "error" : "complete",
					},
					toolMeta,
				);
				rawText += buildToolResultLogLine(chunk);
			}
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

		agentRuns.result(run, result, rawText, {
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
			rawTextLength: rawText.length,
			rawTextPreview:
				rawText.length > 1000 ? `${rawText.slice(0, 1000)}...` : rawText,
			systemPrompt,
			userPromptPreview:
				userPrompt.length > 500 ? `${userPrompt.slice(0, 500)}...` : userPrompt,
		});
		agentRuns.lifecycle(run, "error", {
			error: error instanceof Error ? error.message : "unknown error",
			rawText,
		});
		throw error;
	}
}

function isRunErrorChunk(
	chunk: StreamChunk,
): chunk is Extract<StreamChunk, { type: "RUN_ERROR" }> {
	return chunk.type === "RUN_ERROR";
}

function isToolCallEndChunk(
	chunk: StreamChunk,
): chunk is Extract<StreamChunk, { type: "TOOL_CALL_END" }> {
	return chunk.type === "TOOL_CALL_END";
}

function buildToolResultLogLine(
	chunk: Extract<StreamChunk, { type: "TOOL_CALL_END" }>,
) {
	const toolEvent = buildToolEvent(chunk);
	const toolName = toolEvent.name;
	const input = toolEvent.arguments;
	const result =
		toolEvent.resultContent === undefined
			? ""
			: typeof toolEvent.resultContent === "string"
				? toolEvent.resultContent
				: JSON.stringify(toolEvent.resultContent);

	return `\n[tool:${toolName}] input=${input}${result ? ` result=${result}` : ""}`;
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

function readToolResultError(result: unknown): string | undefined {
	if (typeof result !== "object" || result === null) return undefined;
	const errorValue = (result as { error?: unknown }).error;
	if (typeof errorValue !== "object" || errorValue === null) return undefined;
	return typeof (errorValue as { message?: unknown }).message === "string"
		? (errorValue as { message: string }).message
		: undefined;
}
