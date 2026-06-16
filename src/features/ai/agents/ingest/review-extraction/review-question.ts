import type { ToolSet } from "ai";
import {
	createAiStreamState,
	createToolResultEmitter,
} from "@/features/ai/core/ai-stream-handler";
import { INGEST_PER_QUESTION_MAX_STEPS } from "@/features/ai/core/agent-limits";
import {
	buildIngestReviewPrepareStep,
	buildIngestReviewStopWhen,
} from "@/features/ai/core/tool-agent-stop-when";
import {
	isSuccessfulNamedToolResult,
	readToolFailureMessage,
	runToolAgentStream,
} from "@/features/ai/core/tool-agent-run";
import {
	readIngestAgentStageStatusReport,
	resolveIngestAgentRunStatus,
	type IngestAgentReportedStatus,
	type IngestAgentStageStatusReport,
} from "@/features/ai/tools/ingest-stage-status";
import type {
	ExtractionWorkspaceQuestion,
	ExtractionWorkspaceState,
} from "@/features/ai/tools/ingest-tools";
import {
	createExtractionWorkspace,
	createIngestExtractionTools,
} from "@/features/ai/tools/ingest-tools";
import type { ProviderConfig, Question } from "@/lib/validation";
import { emitAgentEvent } from "./execute-helpers";
import { buildReviewerSystemPrompt, buildReviewerUserPrompt } from "./prompt";
import type { ReviewExtractionOptions } from "./types";

const UPDATE_EXTRACTED_QUESTION_TOOL = "update_extracted_question";

export async function reviewSingleQuestion(
	config: ProviderConfig,
	sourceText: string,
	question: Question,
	index: number,
	totalQuestions: number,
	options: ReviewExtractionOptions,
): Promise<
	| { question: Question; success: true }
	| { question: Question; success: false; reason: string }
> {
	const label = `Reviewer Q${index + 1}`;
	const agentRunId =
		options.createAgentRunId?.(label) ?? `review-question-${index + 1}`;
	const systemPrompt = buildReviewerSystemPrompt(options.reviewTopics);
	const userPrompt = buildReviewerUserPrompt(sourceText, question, index);
	const workspace = createExtractionWorkspace(
		createReviewWorkspaceState(question),
	);
	let stageStatusReport: IngestAgentStageStatusReport | null = null;
	let reportedStageStatus: IngestAgentReportedStatus | null = null;
	const workspaceTools = createIngestExtractionTools(workspace, {
		onStageStatusReported: ({ output }) => {
			const report = readIngestAgentStageStatusReport(output);
			stageStatusReport = report;
			reportedStageStatus = report?.status ?? null;
		},
	});
	const combinedTools: ToolSet = {
		...workspaceTools,
		...(options.tools ?? {}),
	};
	const streamState = createAiStreamState();
	const toolNamesById = new Map<string, string>();
	const toolFailureMessages: string[] = [];
	let hasSuccessfulUpdate = false;
	let listCallCount = 0;
	let updateCallCount = 0;
	let stoppedAfterNoOpUpdate = false;
	let toolsComplete = false;
	const questionMeta = {
		questionIndex: index,
		questionNumber: index + 1,
	};

	emitAgentEvent(options, {
		eventType: "lifecycle",
		stageId: "review",
		agentRunId,
		label,
		status: "pending",
		systemPrompt,
		userPrompt,
		meta: {
			...questionMeta,
			topic: question.topic ?? "General",
		},
	});
	emitAgentEvent(options, {
		eventType: "lifecycle",
		stageId: "review",
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
				stageId: "review",
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
				stageId: "review",
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
			if (toolName === "list_extracted_questions") {
				listCallCount += 1;
			}
			if (toolName === "update_extracted_question") {
				updateCallCount += 1;
				const output = readToolOutput(toolResult.content);
				if (output?.ok === true && Array.isArray(output.updatedFields)) {
					if (output.updatedFields.length === 0) {
						stoppedAfterNoOpUpdate = true;
					}
					toolsComplete = true;
				}
			}
			if (toolName === "report_agent_stage_status") {
				const report = readIngestAgentStageStatusReport(
					toolResult.content,
				);
				stageStatusReport = report;
				reportedStageStatus = report?.status ?? null;
			}
			if (
				isSuccessfulNamedToolResult(
					toolName,
					toolResult.content,
					UPDATE_EXTRACTED_QUESTION_TOOL,
				)
			) {
				hasSuccessfulUpdate = true;
			}
		};
		const emitToolResult = createToolResultEmitter(
			handleToolResult,
			streamState,
		);

		await runToolAgentStream({
			scope: "ingest.review",
			config,
			callId: agentRunId,
			requestSummary: `question ${index + 1}/${totalQuestions}`,
			metadata: { questionIndex: index + 1, totalQuestions },
			systemPrompt,
			messages: [{ role: "user", content: userPrompt }],
			tools: combinedTools,
			stopWhen: buildIngestReviewStopWhen(INGEST_PER_QUESTION_MAX_STEPS),
			prepareStep: buildIngestReviewPrepareStep({
				shouldFinalize: () => toolsComplete,
				listCallCount: () => listCallCount,
			}),
			streamState,
			onRecoverableError: (message) => {
				emitAgentEvent(options, {
					eventType: "warning",
					stageId: "review",
					agentRunId,
					label,
					warning: `Provider dropped a stream chunk after a tool call (${message}); continuing review.`,
					meta: questionMeta,
				});
			},
			handlers: {
				onTextDelta: (delta) => {
					emitAgentEvent(options, {
						eventType: "token",
						stageId: "review",
						agentRunId,
						label,
						rawText: delta,
						meta: questionMeta,
					});
				},
				onReasoningDelta: (delta) => {
					emitAgentEvent(options, {
						eventType: "token",
						stageId: "review",
						agentRunId,
						label,
						rawText: delta,
						meta: { ...questionMeta, kind: "reasoning" },
					});
				},
				onUsage: (usage) => {
					emitAgentEvent(options, {
						eventType: "token",
						stageId: "review",
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

		if (stoppedAfterNoOpUpdate) {
			emitAgentEvent(options, {
				eventType: "warning",
				stageId: "review",
				agentRunId,
				label,
				warning:
					"Review agent retried a no-op update; stopped the tool loop and kept the workspace question.",
				meta: questionMeta,
			});
		} else if (listCallCount >= 2 && !hasSuccessfulUpdate) {
			emitAgentEvent(options, {
				eventType: "warning",
				stageId: "review",
				agentRunId,
				label,
				warning:
					"Review agent kept re-listing the workspace; stopped the tool loop and kept the current question.",
				meta: questionMeta,
			});
		} else if (updateCallCount >= 2 && hasSuccessfulUpdate) {
			emitAgentEvent(options, {
				eventType: "warning",
				stageId: "review",
				agentRunId,
				label,
				warning:
					"Review agent retried an already-applied update; stopped the tool loop and kept the reviewed question.",
				meta: questionMeta,
			});
		}

		if (toolFailureMessages.length > 0 && !hasSuccessfulUpdate) {
			throw new Error(
				toolFailureMessages[0] ?? "Reviewer could not apply a valid review.",
			);
		}

		const reviewedQuestion = readReviewedQuestion(workspace);
		const resolvedStageStatus = resolveIngestAgentRunStatus({
			reported: stageStatusReport,
			toolFailureMessages,
			hasSuccessfulWork: hasSuccessfulUpdate || listCallCount >= 1,
			fallbackMessage: hasSuccessfulUpdate
				? "Review applied changes without an explicit stage report."
				: "Review completed without changes and without an explicit stage report.",
		});

		emitAgentEvent(options, {
			eventType: "result",
			stageId: "review",
			agentRunId,
			label,
			finalObject: reviewedQuestion,
			rawText: streamState.rawText,
			meta: {
				...questionMeta,
				stageStatusMessage: resolvedStageStatus.message,
			},
		});
		emitAgentEvent(options, {
			eventType: "lifecycle",
			stageId: "review",
			agentRunId,
			label,
			status: resolvedStageStatus.status,
			meta: {
				...questionMeta,
				stageStatusMessage: resolvedStageStatus.message,
				reportedStageStatus,
			},
		});

		return { question: reviewedQuestion, success: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		console.error(
			`[${new Date().toISOString()} ERROR review-extraction] ` +
				`Review Q${index + 1}/${totalQuestions} failed: ${message}`,
			`question="${question.question.slice(0, 120)}..."`,
			`topic=${question.topic ?? "General"}`,
		);

		emitAgentEvent(options, {
			eventType: "lifecycle",
			stageId: "review",
			agentRunId,
			label,
			status: "error",
			error: message,
			meta: questionMeta,
		});
		emitAgentEvent(options, {
			eventType: "warning",
			stageId: "review",
			agentRunId,
			label,
			warning: `Review failed for question #${index + 1}. Keeping the original extracted question.`,
			meta: questionMeta,
		});

		return { question, success: false, reason: message };
	}
}

function readToolOutput(content: unknown): Record<string, unknown> | null {
	if (typeof content !== "object" || content === null) return null;
	return content as Record<string, unknown>;
}

function createReviewWorkspaceState(
	question: Question,
): Partial<ExtractionWorkspaceState> {
	const item: ExtractionWorkspaceQuestion = {
		questionId: "q1",
		question: question.question,
		options: [...question.options],
		answers: [...question.answers],
		scoringMode: question.scoringMode,
		explanation: "",
		topic: question.topic ?? "General",
		deepExplanation: question.deepExplanation,
	};

	return {
		questions: [item],
		nextQuestionNumber: 2,
	};
}

function readReviewedQuestion(
	workspace: ReturnType<typeof createExtractionWorkspace>,
): Question {
	const reviewed = workspace.listQuestions()[0];
	if (!reviewed) {
		throw new Error(
			"Reviewer finished without a question in the review workspace.",
		);
	}

	const { questionId: _questionId, ...question } = reviewed;
	return question;
}
