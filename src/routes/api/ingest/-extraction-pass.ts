import type { ToolSet } from "ai";
import { buildExtractionPrepareStep, buildIngestExtractionStopWhen } from "@/features/ai/core/tool-agent-stop-when";
import { parseExamNameFromFileName } from "@/features/ai/agents/ingest/parse-exam-name";
import { buildSystemPrompt } from "@/features/ai/agents/ingest/system-prompt";
import { INGEST_EXTRACTION_MAX_STEPS } from "@/features/ai/core/agent-limits";
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
import { readToolFailureMessage } from "@/features/ai/core/tool-agent-run";
import { loggedStreamText } from "@/features/ai/core/logged-stream-text";
import { createLlmLogContext } from "@/lib/llm-logging";
import type { AgentRunDescriptor } from "@/features/ai/core/ui-message-job-stream";
import type { AgentRunStatus } from "@/features/ai/types/ui-message-data-parts";
import {
	createExtractionWorkspace,
	createIngestExtractionTools,
} from "@/features/ai/tools/ingest-tools";
import {
	readIngestAgentStageStatusReport,
	resolveIngestAgentRunStatus,
	type IngestAgentReportedStatus,
	type IngestAgentStageStatusReport,
} from "@/features/ai/tools/ingest-stage-status";
import type { ExamIngestResponse, ProviderConfig } from "@/lib/validation";
import type { IngestAgentResolvedStatus } from "@/features/ai/tools/ingest-stage-status";
import { buildExtractionUserPrompt, estimateSourceQuestionCount } from "./-extract-text";

interface ExtractionPassParams {
	text: string;
	fileName: string;
	config: ProviderConfig;
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
				name?: string;
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

export interface ExtractionPassResult {
	result: ExamIngestResponse;
	stageStatus: IngestAgentResolvedStatus;
	stageStatusMessage: string;
}

export async function runExtractionPass(
	params: ExtractionPassParams,
): Promise<ExtractionPassResult> {
	const {
		text,
		fileName,
		config,
		agentRuns,
		onWarning,
		log,
		stageId,
		stageLabel,
	} = params;

	const examName = parseExamNameFromFileName(fileName);
	const expectedQuestionCount = estimateSourceQuestionCount(text);
	const systemPrompt = buildSystemPrompt({ enableWebVerification: false });
	const userPrompt = buildExtractionUserPrompt(text, {
		fileName,
		examName,
		expectedQuestionCount,
	});
	const run = agentRuns.createRun(stageId, stageLabel);
	const workspace = createExtractionWorkspace({ examName });
	const streamState = createAiStreamState();
	let stoppedAfterDuplicateAdd = false;
	let stageStatusReport: IngestAgentStageStatusReport | null = null;
	let reportedStageStatus: IngestAgentReportedStatus | null = null;
	const toolFailureMessages: string[] = [];
	const emitToolResult = createToolResultEmitter((toolResult) => {
		const tracked = streamState.toolCalls.get(toolResult.toolCallId);
		agentRuns.toolResult(
			run,
			{
				name: tracked?.name,
				content: toolResult.content,
				error: toolResult.error,
				state: toolResult.state,
			},
			{ toolCallId: toolResult.toolCallId },
		);
	}, streamState);
	const tools = createIngestExtractionTools(workspace, {
		onToolExecuted: async ({ toolName, toolCallId, output }) => {
			const toolFailure = readToolFailureMessage(output);
			if (toolFailure) {
				toolFailureMessages.push(toolFailure);
			}
			if (
				toolName === "add_extracted_question" &&
				typeof output === "object" &&
				output !== null &&
				(output as { alreadyExists?: boolean }).alreadyExists === true
			) {
				stoppedAfterDuplicateAdd = true;
			}
			emitToolResult(payloadFromToolExecuteResult(toolCallId, output));
		},
		onStageStatusReported: ({ output }) => {
			const report = readIngestAgentStageStatusReport(output);
			stageStatusReport = report;
			reportedStageStatus = report?.status ?? null;
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
				stopWhen: buildIngestExtractionStopWhen(INGEST_EXTRACTION_MAX_STEPS),
				prepareStep: buildExtractionPrepareStep(workspace, {
					expectedQuestionCount,
					shouldFinalize: () => stoppedAfterDuplicateAdd,
				}),
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

		if (stoppedAfterDuplicateAdd) {
			onWarning(
				"Extraction agent retried an already-registered question; stopped the tool loop and kept the workspace result.",
			);
		}

		const extractionResult = workspace.buildResult();
		const resolvedStageStatus = resolveIngestAgentRunStatus({
			reported: stageStatusReport,
			toolFailureMessages,
			hasSuccessfulWork: extractionResult.questions.length > 0,
			fallbackMessage: `Extracted ${extractionResult.questions.length} question(s) without an explicit stage report.`,
		});

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
			stageStatusMessage: resolvedStageStatus.message,
		});
		agentRuns.lifecycle(run, resolvedStageStatus.status as AgentRunStatus, {
			meta: {
				examName: extractionResult.examName,
				questionCount: extractionResult.questions.length,
				topicCount: extractionResult.topics.length,
				stageStatusMessage: resolvedStageStatus.message,
				reportedStageStatus,
			},
		});
		return {
			result: extractionResult,
			stageStatus: resolvedStageStatus.status,
			stageStatusMessage: resolvedStageStatus.message,
		};
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
