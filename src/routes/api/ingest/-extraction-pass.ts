import { stepCountIs, type ToolSet } from "ai";
import { parseExamNameFromFileName } from "@/features/ai/agents/ingest/parse-exam-name";
import { buildSystemPrompt } from "@/features/ai/agents/ingest/system-prompt";
import { buildProviderOptions } from "@/features/ai/adapters/provider-options";
import { getAiModel } from "@/features/ai/adapters/provider-model";
import {
	createAiStreamState,
	createToolResultEmitter,
	isAiStreamRunErrorChunk,
	isRecoverableStreamPartError,
	payloadFromToolExecuteResult,
	processAiStreamPart,
} from "@/features/ai/core/ai-stream-handler";
import { loggedStreamText } from "@/features/ai/core/logged-stream-text";
import { createLlmLogContext } from "@/lib/llm-logging";
import type { AgentRunDescriptor } from "@/features/ai/core/ui-message-job-stream";
import type { AgentRunStatus } from "@/features/ai/types/ui-message-data-parts";
import {
	createExtractionWorkspace,
	createIngestExtractionTools,
} from "@/features/ai/tools/ingest-tools";
import type { ExamIngestResponse, ProviderConfig } from "@/lib/validation";
import { buildExtractionUserPrompt } from "./-extract-text";

interface ExtractionPassParams {
	text: string;
	fileName: string;
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
		textDelta(run: AgentRunDescriptor, delta: string): void;
		reasoningDelta(run: AgentRunDescriptor, delta: string): void;
	};
	onWarning: (message: string) => void;
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
		fileName,
		config,
		criticalTopics,
		agentRuns,
		onWarning,
		log,
		stageId,
		stageLabel,
	} = params;

	const examName = parseExamNameFromFileName(fileName);
	const systemPrompt = buildSystemPrompt({
		criticalTopics,
		enableWebVerification: false,
	});
	const userPrompt = buildExtractionUserPrompt(text, { fileName, examName });
	const run = agentRuns.createRun(stageId, stageLabel);
	const workspace = createExtractionWorkspace({ examName });
	const streamState = createAiStreamState();
	const emitToolResult = createToolResultEmitter((toolResult) => {
		agentRuns.toolResult(
			run,
			{
				content: toolResult.content,
				error: toolResult.error,
				state: toolResult.state,
			},
			{ toolCallId: toolResult.toolCallId },
		);
	}, streamState);
	const tools = createIngestExtractionTools(workspace, {
		onToolExecuted: async ({ toolCallId, output }) => {
			emitToolResult(payloadFromToolExecuteResult(toolCallId, output));
		},
	});

	agentRuns.lifecycle(run, "pending", { systemPrompt, userPrompt });
	agentRuns.lifecycle(run, "running");

	try {
		const result = loggedStreamText(
			createLlmLogContext("ingest.extraction", config, {
				callId: run.agentRunId,
				systemPrompt,
				requestSummary: stageLabel,
				metadata: { stageId, agentRunId: run.agentRunId },
			}),
			{
				model: getAiModel(config),
				system: systemPrompt,
				messages: [{ role: "user", content: userPrompt }],
				tools: tools as ToolSet,
				stopWhen: stepCountIs(10),
				providerOptions: buildProviderOptions(config),
			},
		);

		for await (const chunk of result.fullStream) {
			if (isAiStreamRunErrorChunk(chunk)) {
				const message =
					chunk.error instanceof Error
						? chunk.error.message
						: String(chunk.error);

				if (isRecoverableStreamPartError(chunk)) {
					log.error("AI extraction pass recoverable stream error", chunk, {
						stage: stageId,
						agentRunId: run.agentRunId,
						label: stageLabel,
						rawTextLength: streamState.rawText.length,
					});
					onWarning(
						`Provider dropped a stream chunk after a tool call (${message}); continuing with extracted questions.`,
					);
					continue;
				}

				log.error("AI extraction pass run error", chunk, {
					stage: stageId,
					agentRunId: run.agentRunId,
					label: stageLabel,
					rawTextLength: streamState.rawText.length,
				});
				throw new Error(`AI provider returned error: ${message}`);
			}

			processAiStreamPart(
				chunk,
				{
					onTextDelta: (delta) => {
						agentRuns.textDelta(run, delta);
					},
					onReasoningDelta: (delta) => {
						agentRuns.reasoningDelta(run, delta);
					},
					onUsage: (usage) => {
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
					onToolResult: emitToolResult,
				},
				streamState,
			);
		}

		const extractionResult = workspace.buildResult();
		if (extractionResult.questions.length > 1) {
			onWarning(
				`Extracted ${extractionResult.questions.length} questions — verify the count matches the source exam.`,
			);
		}
		if (extractionResult.questions.length === 0) {
			const message =
				"No questions were extracted during the initial ingest pass.";
			onWarning(message);
			throw new Error(message);
		}

		agentRuns.result(run, extractionResult, streamState.rawText, {
			toolQuestionCount: workspace.listQuestions().length,
		});
		agentRuns.lifecycle(run, "done", {
			meta: {
				examName: extractionResult.examName,
				questionCount: extractionResult.questions.length,
				topicCount: extractionResult.topics.length,
			},
		});
		return extractionResult;
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
