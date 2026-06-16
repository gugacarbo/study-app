import type { ToolSet } from "ai";
import { INGEST_PER_QUESTION_MAX_STEPS } from "@/features/ai/core/agent-limits";
import {
	isSuccessfulNamedToolResult,
	readToolFailureMessage,
} from "@/features/ai/core/tool-agent-run";
import {
	buildIngestReviewPrepareStep,
	buildIngestReviewStopWhen,
} from "@/features/ai/core/tool-agent-stop-when";
import type { AgentRunDescriptor } from "@/features/ai/core/ui-message-job-stream";
import { createPipelineAgentEmitter } from "@/features/ai/pipeline/server/agent-emitter";
import { runPipelineToolAgent } from "@/features/ai/pipeline/server/run-pipeline-tool-agent";
import type { AgentEventEmitter } from "@/features/ai/pipeline/types";
import {
	type IngestAgentReportedStatus,
	type IngestAgentStageStatusReport,
	readIngestAgentStageStatusReport,
	resolveIngestAgentRunStatus,
} from "@/features/ai/tools/ingest-stage-status";
import type {
	ExtractionWorkspaceQuestion,
	ExtractionWorkspaceState,
} from "@/features/ai/tools/ingest-tools";
import {
	createExtractionWorkspace,
	createIngestReviewTools,
	formatExtractionQuestionId,
} from "@/features/ai/tools/ingest-tools";
import type { AgentRunDataPart } from "@/features/ai/types/ui-message-data-parts";
import type { ProviderConfig, Question } from "@/lib/validation";
import { buildReviewerSystemPrompt, buildReviewerUserPrompt } from "./prompt";
import type { IngestReviewAgentEvent, ReviewExtractionOptions } from "./types";

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
	const workspaceQuestionId = formatExtractionQuestionId(index + 1);
	const systemPrompt = buildReviewerSystemPrompt(
		options.reviewTopics,
		workspaceQuestionId,
	);
	const userPrompt = buildReviewerUserPrompt(sourceText, question, index);
	const workspace = createExtractionWorkspace(
		createReviewWorkspaceState(question, index),
	);
	let stageStatusReport: IngestAgentStageStatusReport | null = null;
	let reportedStageStatus: IngestAgentReportedStatus | null = null;
	const toolFailureMessages: string[] = [];
	let hasSuccessfulUpdate = false;
	let updateCallCount = 0;
	let stoppedAfterNoOpUpdate = false;
	let toolsComplete = false;
	const questionMeta = {
		questionIndex: index,
		questionNumber: index + 1,
	};

	const run: AgentRunDescriptor = {
		stageId: "review",
		agentRunId,
		label,
	};

	const emit: AgentEventEmitter = createPipelineAgentEmitter(
		"review",
		run,
		(event) => {
			options.onAgentEvent?.(event as IngestReviewAgentEvent);
		},
	);
	const emitPartial = (
		event: Omit<
			AgentRunDataPart,
			"timestamp" | "stageId" | "agentRunId" | "label"
		>,
	) => {
		emit({ ...run, ...event });
	};

	const hasWorkspaceUpdate = () => {
		const reviewed = workspace.listQuestions()[0];
		if (!reviewed) return false;
		return (
			reviewed.question !== question.question ||
			reviewed.options.join("\0") !== question.options.join("\0") ||
			reviewed.answers.join("\0") !== question.answers.join("\0") ||
			reviewed.scoringMode !== question.scoringMode ||
			(reviewed.topic ?? "General") !== (question.topic ?? "General") ||
			reviewed.explanation !== (question.explanation ?? "")
		);
	};

	try {
		const workspaceTools = createIngestReviewTools(workspace, {
			onToolExecuted: async ({ toolName, toolCallId, output }) => {
				const toolFailure = readToolFailureMessage(output);
				if (toolFailure) {
					toolFailureMessages.push(toolFailure);
				}
				if (toolName === UPDATE_EXTRACTED_QUESTION_TOOL) {
					updateCallCount += 1;
					const toolOutput = readToolOutput(output);
					if (
						toolOutput?.ok === true &&
						Array.isArray(toolOutput.updatedFields)
					) {
						if (toolOutput.updatedFields.length === 0) {
							stoppedAfterNoOpUpdate = true;
						}
						toolsComplete = true;
					}
				}
				if (
					isSuccessfulNamedToolResult(
						toolName,
						output,
						UPDATE_EXTRACTED_QUESTION_TOOL,
					)
				) {
					hasSuccessfulUpdate = true;
				}
				emitPartial({
					eventType: "tool-result",
					name: toolName,
					content: output,
					state: "complete",
					meta: { ...questionMeta, toolCallId },
				});
			},
			onStageStatusReported: async ({ toolCallId, output }) => {
				const report = readIngestAgentStageStatusReport(output);
				stageStatusReport = report;
				reportedStageStatus = report?.status ?? null;
				emitPartial({
					eventType: "tool-result",
					name: "report_agent_stage_status",
					content: output,
					state: "complete",
					meta: { ...questionMeta, toolCallId },
				});
			},
		});
		const combinedTools: ToolSet = {
			...workspaceTools,
			...(options.tools ?? {}),
		};

		const agentResult = await runPipelineToolAgent({
			scope: "ingest.review",
			stageId: "review",
			config,
			run,
			emit,
			systemPrompt,
			messages: [{ role: "user", content: userPrompt }],
			tools: combinedTools,
			stopWhen: buildIngestReviewStopWhen(INGEST_PER_QUESTION_MAX_STEPS),
			prepareStep: buildIngestReviewPrepareStep({
				shouldFinalize: () => toolsComplete,
			}),
			meta: questionMeta,
			requestSummary: `question ${index + 1}/${totalQuestions}`,
			onRecoverableError: (message) => {
				emitPartial({
					eventType: "warning",
					warning: `Provider dropped a stream chunk after a tool call (${message}); continuing review.`,
					meta: questionMeta,
				});
			},
			isSuccess: ({ toolFailureMessages: pipelineFailures, streamState }) => {
				const noFailures =
					toolFailureMessages.length === 0 && pipelineFailures.length === 0;
				if (
					hasSuccessfulUpdate ||
					stageStatusReport != null ||
					hasWorkspaceUpdate()
				) {
					return true;
				}
				if (noFailures && (toolsComplete || stoppedAfterNoOpUpdate)) {
					return true;
				}
				return noFailures && streamState.emittedToolResultIds.size > 0;
			},
			failureReason: ({ toolFailureMessages: pipelineFailures }) =>
				toolFailureMessages[0] ??
				pipelineFailures[0] ??
				"Reviewer could not apply a valid review.",
		});

		if (!agentResult.success) {
			throw new Error(agentResult.reason ?? "Review failed");
		}

		if (stoppedAfterNoOpUpdate) {
			emitPartial({
				eventType: "warning",
				warning:
					"Review agent retried a no-op update; stopped the tool loop and kept the workspace question.",
				meta: questionMeta,
			});
		} else if (updateCallCount >= 2 && hasSuccessfulUpdate) {
			emitPartial({
				eventType: "warning",
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
			hasSuccessfulWork: hasSuccessfulUpdate || stageStatusReport != null,
			fallbackMessage: hasSuccessfulUpdate
				? "Review applied changes without an explicit stage report."
				: "Review completed without changes and without an explicit stage report.",
		});

		emitPartial({
			eventType: "result",
			finalObject: reviewedQuestion,
			rawText: agentResult.rawText,
			meta: {
				...questionMeta,
				stageStatusMessage: resolvedStageStatus.message,
			},
		});
		emitPartial({
			eventType: "lifecycle",
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

		emitPartial({
			eventType: "lifecycle",
			status: "error",
			error: message,
			meta: questionMeta,
		});
		emitPartial({
			eventType: "warning",
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
	index: number,
): Partial<ExtractionWorkspaceState> {
	const questionId = formatExtractionQuestionId(index + 1);
	const item: ExtractionWorkspaceQuestion = {
		questionId,
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
		nextQuestionNumber: index + 2,
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
