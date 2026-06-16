import type { ToolSet } from "ai";
import {
	createAiStreamState,
	createToolResultEmitter,
} from "@/features/ai/core/ai-stream-handler";
import { INGEST_PER_QUESTION_MAX_STEPS } from "@/features/ai/core/agent-limits";
import { buildIngestExplanationStopWhen, buildPostUpdatePrepareStep } from "@/features/ai/core/tool-agent-stop-when";
import {
	isSuccessfulNamedToolResult,
	readToolFailureMessage,
	runToolAgentStream,
} from "@/features/ai/core/tool-agent-run";
import {
	createExplanationTools,
	createExplanationWorkspace,
} from "@/features/ai/tools/explanation-tools";
import {
	createReportAgentStageStatusTool,
	readIngestAgentStageStatusReport,
	resolveIngestAgentRunStatus,
	type IngestAgentReportedStatus,
	type IngestAgentStageStatusReport,
} from "@/features/ai/tools/ingest-stage-status";
import type { ProviderConfig } from "@/lib/validation";
import { buildSystemPrompt } from "../system-prompt";
import { emitAgentEvent } from "./execute-helpers";
import { buildExplanationUserPrompt } from "./prompt";
import type {
	ExplanationBatchInput,
	ExplanationQuestionResult,
	RunQuestionExplanationsOptions,
} from "./types";

const UPDATE_QUESTION_EXPLANATION_TOOL = "update_question_explanation";

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
	const streamState = createAiStreamState();
	const toolNamesById = new Map<string, string>();
	const toolFailureMessages: string[] = [];
	let stageStatusReport: IngestAgentStageStatusReport | null = null;
	let reportedStageStatus: IngestAgentReportedStatus | null = null;
	let hasSuccessfulUpdate = false;
	let updateCallCount = 0;
	let toolsComplete = false;
	const explanationTools = createExplanationTools(workspace);
	const stageStatusTools = createReportAgentStageStatusTool({
		onToolExecuted: ({ output }) => {
			const report = readIngestAgentStageStatusReport(output);
			stageStatusReport = report;
			reportedStageStatus = report?.status ?? null;
		},
	});
	const combinedTools: ToolSet = {
		...explanationTools,
		...stageStatusTools,
		...(options.tools as ToolSet | undefined),
	};
	const questionMeta = {
		questionIndex: index,
		questionNumber: index + 1,
	};

	emitAgentEvent(options, {
		eventType: "lifecycle",
		stageId: "explanations",
		agentRunId,
		label,
		status: "pending",
		systemPrompt,
		userPrompt,
		meta: {
			...questionMeta,
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
		meta: questionMeta,
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
				stageId: "explanations",
				agentRunId,
				label,
				name: toolCall.name,
				arguments: toolCall.arguments,
				input: toolCall.input,
				state: toolCall.state,
				meta: {
					...questionMeta,
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
					...questionMeta,
					toolCallId: toolResult.toolCallId,
				},
			});

			const toolFailure = readToolFailureMessage(toolResult.content);
			if (toolFailure) {
				toolFailureMessages.push(toolFailure);
			}
			const toolName =
				toolNamesById.get(toolResult.toolCallId) ?? "unknown_tool";
			if (toolName === "update_question_explanation") {
				updateCallCount += 1;
			}
			if (
				isSuccessfulNamedToolResult(
					toolName,
					toolResult.content,
					UPDATE_QUESTION_EXPLANATION_TOOL,
				)
			) {
				hasSuccessfulUpdate = true;
				toolsComplete = true;
			}
			if (toolName === "report_agent_stage_status") {
				const report = readIngestAgentStageStatusReport(
					toolResult.content,
				);
				stageStatusReport = report;
				reportedStageStatus = report?.status ?? null;
			}
		};
		const emitToolResult = createToolResultEmitter(
			handleToolResult,
			streamState,
		);

		await runToolAgentStream({
			scope: "explanations.generate",
			config,
			callId: agentRunId,
			requestSummary: `question ${index + 1}/${totalQuestions}`,
			metadata: {
				questionId: question.id,
				questionIndex: index + 1,
				totalQuestions,
			},
			systemPrompt,
			messages: [{ role: "user", content: userPrompt }],
			tools: combinedTools,
			stopWhen: buildIngestExplanationStopWhen(INGEST_PER_QUESTION_MAX_STEPS),
			prepareStep: buildPostUpdatePrepareStep(() => toolsComplete),
			streamState,
			onRecoverableError: (message) => {
				emitAgentEvent(options, {
					eventType: "warning",
					stageId: "explanations",
					agentRunId,
					label,
					warning: `Provider dropped a stream chunk after a tool call (${message}); continuing explanation generation.`,
					meta: questionMeta,
				});
			},
			handlers: {
				onTextDelta: (delta) => {
					emitAgentEvent(options, {
						eventType: "token",
						stageId: "explanations",
						agentRunId,
						label,
						rawText: delta,
						meta: questionMeta,
					});
				},
				onReasoningDelta: (delta) => {
					emitAgentEvent(options, {
						eventType: "token",
						stageId: "explanations",
						agentRunId,
						label,
						rawText: delta,
						meta: { ...questionMeta, kind: "reasoning" },
					});
				},
				onUsage: (usage) => {
					emitAgentEvent(options, {
						eventType: "token",
						stageId: "explanations",
						agentRunId,
						label,
						tokens: usage,
						meta: questionMeta,
					});
				},
				onToolCall: handleToolCall,
				onToolResult: emitToolResult,
			},
		});

		if (updateCallCount >= 2 && hasSuccessfulUpdate) {
			emitAgentEvent(options, {
				eventType: "warning",
				stageId: "explanations",
				agentRunId,
				label,
				warning:
					"Explanation agent retried an already-written explanation; stopped the tool loop and kept the workspace result.",
				meta: questionMeta,
			});
		}

		if (
			toolFailureMessages.length > 0 &&
			!hasSuccessfulUpdate &&
			!workspaceHasCompleteExplanation(workspace, question.id)
		) {
			throw new Error(
				toolFailureMessages[0] ??
					"Explanation agent could not apply a valid explanation update.",
			);
		}

		if (
			!hasSuccessfulUpdate &&
			!workspaceHasCompleteExplanation(workspace, question.id)
		) {
			throw new Error(
				"Explanation agent finished without calling update_question_explanation.",
			);
		}

		const generated = readGeneratedExplanation(workspace, question.id);
		const resolvedStageStatus = resolveIngestAgentRunStatus({
			reported: stageStatusReport,
			toolFailureMessages,
			hasSuccessfulWork:
				hasSuccessfulUpdate ||
				workspaceHasCompleteExplanation(workspace, question.id),
			fallbackMessage: hasSuccessfulUpdate
				? "Explanation written without an explicit stage report."
				: "Explanation stage finished without an explicit stage report.",
		});

		emitAgentEvent(options, {
			eventType: "result",
			stageId: "explanations",
			agentRunId,
			label,
			finalObject: generated,
			rawText: streamState.rawText,
			meta: {
				...questionMeta,
				stageStatusMessage: resolvedStageStatus.message,
			},
		});
		emitAgentEvent(options, {
			eventType: "lifecycle",
			stageId: "explanations",
			agentRunId,
			label,
			status: resolvedStageStatus.status,
			meta: {
				...questionMeta,
				stageStatusMessage: resolvedStageStatus.message,
				reportedStageStatus,
			},
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
			meta: questionMeta,
		});
		if (!options.suppressFailureWarning) {
			emitAgentEvent(options, {
				eventType: "warning",
				stageId: "explanations",
				agentRunId,
				label,
				warning: `Explanation generation failed for question #${index + 1}. Keeping the original question.`,
				meta: questionMeta,
			});
		}

		return { question, success: false, reason: message };
	}
}

function workspaceHasCompleteExplanation(
	workspace: ReturnType<typeof createExplanationWorkspace>,
	questionId: number,
): boolean {
	const question = workspace
		.listQuestions()
		.find((item) => item.id === questionId);
	return Boolean(
		question?.explanation.trim() && question.deepExplanation.trim(),
	);
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
