import type { ToolSet } from "ai";
import { INGEST_PER_QUESTION_MAX_STEPS } from "@/features/ai/core/agent-limits";
import { payloadFromToolExecuteResult } from "@/features/ai/core/ai-stream-handler";
import {
	buildIngestExplanationStopWhen,
	buildPostUpdatePrepareStep,
} from "@/features/ai/core/tool-agent-stop-when";
import type { AgentRunDescriptor } from "@/features/ai/core/ui-message-job-stream";
import { runPipelineToolAgent } from "@/features/ai/pipeline/server/run-pipeline-tool-agent";
import type { AgentEventEmitter } from "@/features/ai/pipeline/types";
import {
	createExplanationTools,
	createExplanationWorkspace,
} from "@/features/ai/tools/explanation-tools";
import type { ProviderConfig, ResolvedModelConfig } from "@/lib/validation";
import { toProviderConfig } from "@/lib/validation";
import type { ExplanationBatchInput } from "../generate-explanations/types";
import {
	EXPLAIN_QUESTION_AGENT_STAGE_ID,
	type ExplainQuestionAgentEvent,
	type ExplainQuestionByIdOptions,
	UPDATE_QUESTION_EXPLANATION_TOOL,
} from "./contracts";
import { buildExplainQuestionUserPrompt } from "./prompt";
import { buildExplainQuestionSystemPrompt } from "./system-prompt";

function resolveEmit(options: ExplainQuestionByIdOptions): AgentEventEmitter {
	if (options.emit) return options.emit;
	return (event) => {
		options.onAgentEvent?.(event as ExplainQuestionAgentEvent);
	};
}

export async function explainQuestionById(
	config: ProviderConfig | ResolvedModelConfig,
	question: ExplanationBatchInput & { deepExplanation?: string },
	options: ExplainQuestionByIdOptions = {},
): Promise<
	| {
			result: {
				questionId: number;
				explanation: string;
				deepExplanation: string;
			};
			success: true;
	  }
	| { questionId: number; success: false; reason: string }
> {
	const questionId = question.id;
	const label = `Explanation Q${questionId}`;
	const agentRunId =
		options.createAgentRunId?.(label) ?? `explain-question-${questionId}`;
	const run: AgentRunDescriptor = {
		stageId: EXPLAIN_QUESTION_AGENT_STAGE_ID,
		agentRunId,
		label,
	};
	const emit = resolveEmit(options);
	const memoryContext = options.resolveMemoryContext?.();
	const systemPrompt = buildExplainQuestionSystemPrompt(
		questionId,
		memoryContext,
	);
	const userPrompt = buildExplainQuestionUserPrompt(questionId, {
		overwrite: options.overwrite,
	});
	const workspace = createExplanationWorkspace([question]);
	const toolNamesById = new Map<string, string>();
	const toolFailureMessages: string[] = [];
	let hasSuccessfulUpdate = false;
	let toolsComplete = false;
	const baseMeta = { questionId };
	const providerConfig = toProviderConfig(config);

	const handleToolResult = (toolResult: {
		toolCallId: string;
		content?: unknown;
		error?: string;
		state: "streaming" | "complete" | "error";
	}) => {
		const toolName = toolNamesById.get(toolResult.toolCallId) ?? "unknown_tool";
		emit({
			eventType: "tool-result",
			stageId: run.stageId,
			agentRunId: run.agentRunId,
			label: run.label,
			name: toolName,
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

		if (isSuccessfulUpdateToolResult(toolName, toolResult.content)) {
			hasSuccessfulUpdate = true;
			toolsComplete = true;
			const content = toolResult.content as {
				ok: true;
				questionId: number;
				updatedFields: readonly ["explanation", "deepExplanation"];
			};
			const updated = workspace
				.listQuestions()
				.find((item) => item.id === content.questionId);
			if (updated) {
				options.onWorkspaceUpdate?.({
					questionId: content.questionId,
					explanation: updated.explanation,
					deepExplanation: updated.deepExplanation,
					updatedFields: [...content.updatedFields],
				});
			}
		}
	};

	const explanationTools = createExplanationTools(workspace, {
		onToolExecuted: async ({ toolCallId, toolName, output }) => {
			toolNamesById.set(toolCallId, toolName);
			const payload = payloadFromToolExecuteResult(toolCallId, output);
			handleToolResult({
				toolCallId,
				content: payload.content,
				error: payload.error,
				state: payload.state,
			});
		},
	});
	const combinedTools: ToolSet = {
		...explanationTools,
		...(options.tools ?? {}),
	};

	const hasWorkspaceUpdate = () => {
		if (hasSuccessfulUpdate) return true;
		const generated = workspace
			.buildResult()
			.questions.find((item) => item.id === questionId);
		if (!generated) return false;
		return (
			generated.explanation !== question.explanation ||
			generated.deepExplanation !== (question.deepExplanation ?? "")
		);
	};

	const pipelineResult = await runPipelineToolAgent({
		scope: "explain-question",
		stageId: EXPLAIN_QUESTION_AGENT_STAGE_ID,
		config: providerConfig,
		run,
		emit,
		systemPrompt,
		messages: [{ role: "user", content: userPrompt }],
		tools: combinedTools,
		stopWhen: buildIngestExplanationStopWhen(INGEST_PER_QUESTION_MAX_STEPS),
		prepareStep: buildPostUpdatePrepareStep(() => toolsComplete),
		meta: baseMeta,
		requestSummary: `questionId=${questionId}`,
		isSuccess: hasWorkspaceUpdate,
		failureReason: () =>
			toolFailureMessages[0] ??
			(hasSuccessfulUpdate
				? undefined
				: "Explanation agent finished without calling update_question_explanation."),
		stageStatus: {
			hasSuccessfulWork: hasWorkspaceUpdate,
		},
	});

	if (!pipelineResult.success) {
		const message = pipelineResult.reason ?? "unknown error";
		console.error(
			`[${new Date().toISOString()} ERROR explain-question] ` +
				`Explanation Q${questionId} failed: ${message}`,
		);
		return { questionId, success: false, reason: message };
	}

	const generated = readGeneratedExplanation(workspace, questionId);
	const resolvedStageStatus = pipelineResult.resolvedStageStatus ?? {
		status: "done" as const,
		message: "Explanation stage finished.",
	};

	emit({
		eventType: "result",
		stageId: run.stageId,
		agentRunId: run.agentRunId,
		label: run.label,
		finalObject: generated,
		rawText: pipelineResult.rawText,
		meta: {
			...baseMeta,
			stageStatusMessage: resolvedStageStatus.message,
		},
	});

	return {
		result: {
			questionId,
			explanation: generated.explanation,
			deepExplanation: generated.deepExplanation,
		},
		success: true,
	};
}

function readGeneratedExplanation(
	workspace: ReturnType<typeof createExplanationWorkspace>,
	questionId: number,
) {
	const built = workspace.buildResult();
	const generated = built.questions.find((item) => item.id === questionId);
	if (!generated) {
		throw new Error(
			"Explanation agent finished without an explanation in the workspace.",
		);
	}
	return generated;
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
	if (toolName !== UPDATE_QUESTION_EXPLANATION_TOOL) return false;
	if (typeof result !== "object" || result === null) return false;
	return (result as { ok?: unknown }).ok === true;
}
