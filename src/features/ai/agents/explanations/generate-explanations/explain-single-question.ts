import type { ToolSet } from "ai";
import { INGEST_PER_QUESTION_MAX_STEPS } from "@/features/ai/core/agent-limits";
import {
	isSuccessfulNamedToolResult,
	readToolFailureMessage,
} from "@/features/ai/core/tool-agent-run";
import {
	buildIngestExplanationStopWhen,
	buildPostUpdatePrepareStep,
} from "@/features/ai/core/tool-agent-stop-when";
import type { AgentRunDescriptor } from "@/features/ai/core/ui-message-job-stream";
import { createPipelineAgentEmitter } from "@/features/ai/pipeline/server/agent-emitter";
import { runPipelineToolAgent } from "@/features/ai/pipeline/server/run-pipeline-tool-agent";
import type { AgentEventEmitter } from "@/features/ai/pipeline/types";
import {
	createExplanationTools,
	createExplanationWorkspace,
} from "@/features/ai/tools/explanation-tools";
import type { AgentRunDataPart } from "@/features/ai/types/ui-message-data-parts";
import type { ProviderConfig } from "@/lib/validation";
import { buildSystemPrompt } from "../system-prompt";
import { buildExplanationUserPrompt } from "./prompt";
import type {
	ExplanationAgentRunEvent,
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
	const systemPrompt = buildSystemPrompt(memoryContext, question.id);
	const userPrompt = buildExplanationUserPrompt(question, index);
	const workspace = createExplanationWorkspace([question]);
	const toolFailureMessages: string[] = [];
	let hasSuccessfulUpdate = false;
	let updateCallCount = 0;
	let toolsComplete = false;
	const questionMeta = {
		questionIndex: index,
		questionNumber: index + 1,
	};

	const run: AgentRunDescriptor = {
		stageId: "explanations",
		agentRunId,
		label,
	};

	const emit: AgentEventEmitter = createPipelineAgentEmitter(
		"explanations",
		run,
		(event) => {
			options.onAgentEvent?.(event as ExplanationAgentRunEvent);
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

	try {
		const explanationTools = createExplanationTools(workspace, {
			onToolExecuted: async ({ toolName, toolCallId, output }) => {
				const toolFailure = readToolFailureMessage(output);
				if (toolFailure) {
					toolFailureMessages.push(toolFailure);
				}
				if (toolName === UPDATE_QUESTION_EXPLANATION_TOOL) {
					updateCallCount += 1;
				}
				if (
					isSuccessfulNamedToolResult(
						toolName,
						output,
						UPDATE_QUESTION_EXPLANATION_TOOL,
					)
				) {
					hasSuccessfulUpdate = true;
					toolsComplete = true;
				}
				emitPartial({
					eventType: "tool-result",
					name: toolName,
					content: output,
					state: "complete",
					meta: { ...questionMeta, toolCallId },
				});
			},
		});
		const combinedTools: ToolSet = {
			...explanationTools,
			...(options.tools as ToolSet | undefined),
		};

		const agentResult = await runPipelineToolAgent({
			scope: "explanations.generate",
			stageId: "explanations",
			config,
			run,
			emit,
			systemPrompt,
			messages: [{ role: "user", content: userPrompt }],
			tools: combinedTools,
			stopWhen: buildIngestExplanationStopWhen(INGEST_PER_QUESTION_MAX_STEPS),
			prepareStep: buildPostUpdatePrepareStep(() => toolsComplete),
			meta: {
				questionId: question.id,
				...questionMeta,
			},
			requestSummary: `question ${index + 1}/${totalQuestions}`,
			onRecoverableError: (message) => {
				emitPartial({
					eventType: "warning",
					warning: `Provider dropped a stream chunk after a tool call (${message}); continuing explanation generation.`,
					meta: questionMeta,
				});
			},
			isSuccess: () =>
				hasSuccessfulUpdate ||
				workspaceHasCompleteExplanation(workspace, question.id),
			failureReason: () =>
				toolFailureMessages[0] ??
				"Explanation agent could not apply a valid explanation update.",
			stageStatus: {
				hasSuccessfulWork: () =>
					hasSuccessfulUpdate ||
					workspaceHasCompleteExplanation(workspace, question.id),
			},
		});

		if (!agentResult.success) {
			throw new Error(agentResult.reason ?? "Explanation generation failed");
		}

		if (updateCallCount >= 2 && hasSuccessfulUpdate) {
			emitPartial({
				eventType: "warning",
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
		const resolvedStageStatus = agentResult.resolvedStageStatus ?? {
			status: "done" as const,
			message: "Explanation stage finished.",
		};

		emitPartial({
			eventType: "result",
			finalObject: generated,
			rawText: agentResult.rawText,
			meta: {
				...questionMeta,
				stageStatusMessage: resolvedStageStatus.message,
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

		emitPartial({
			eventType: "lifecycle",
			status: "error",
			error: message,
			meta: questionMeta,
		});
		if (!options.suppressFailureWarning) {
			emitPartial({
				eventType: "warning",
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
	const item = workspace
		.listQuestions()
		.find((question) => question.id === questionId);
	return Boolean(item?.explanation.trim() && item.deepExplanation.trim());
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
