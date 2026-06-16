import type { ToolSet } from "ai";
import { IMPROVE_QUESTIONS_MAX_STEPS } from "@/features/ai/core/agent-limits";
import { payloadFromToolExecuteResult } from "@/features/ai/core/ai-stream-handler";
import {
	buildImproveQuestionsPrepareStep,
	buildImproveQuestionsStopWhen,
} from "@/features/ai/core/tool-agent-stop-when";
import type { AgentRunDescriptor } from "@/features/ai/core/ui-message-job-stream";
import { runPipelineToolAgent } from "@/features/ai/pipeline/server/run-pipeline-tool-agent";
import type { AgentEventEmitter } from "@/features/ai/pipeline/types";
import {
	createImproveQuestionsTools,
	createImproveQuestionsWorkspace,
} from "@/features/ai/tools/improve-questions-tools";
import { wrapToolSetWithExecutionHook } from "@/features/ai/tools/wrap-tool-set";
import {
	type ProviderConfig,
	type ResolvedModelConfig,
	toProviderConfig,
} from "@/lib/validation";
import {
	type DraftQuestion,
	IMPROVE_QUESTIONS_STAGE_ID,
	type ImproveQuestionsAgentEvent,
	type ImproveQuestionsAgentRunSummary,
	type ImproveSingleQuestionOptions,
	UPDATE_QUESTION_OPTIONS_TOOL,
} from "./contracts";
import { buildUserPrompt } from "./prompt";
import { buildImproveQuestionsSystemPrompt } from "./system-prompt";

function resolveEmit(options: ImproveSingleQuestionOptions): AgentEventEmitter {
	if (options.emit) return options.emit;
	return (event) => {
		options.onAgentEvent?.(event as ImproveQuestionsAgentEvent);
	};
}

export async function improveSingleQuestion(
	config: ProviderConfig | ResolvedModelConfig,
	question: DraftQuestion,
	options: ImproveSingleQuestionOptions = {},
): Promise<
	| {
			question: DraftQuestion;
			agentRun: ImproveQuestionsAgentRunSummary;
			success: true;
	  }
	| {
			question: DraftQuestion;
			agentRun: ImproveQuestionsAgentRunSummary;
			success: false;
			reason: string;
	  }
> {
	const label = `Improve Question Q${question.id}`;
	const agentRunId =
		options.createAgentRunId?.(label) ?? `improve-questions-${question.id}`;
	const run: AgentRunDescriptor = {
		stageId: IMPROVE_QUESTIONS_STAGE_ID,
		agentRunId,
		label,
	};
	const emit = resolveEmit(options);
	const isFollowUp = options.followUp != null;
	const followUp = options.followUp;
	const systemPrompt = buildImproveQuestionsSystemPrompt(question);
	const userPrompt = followUp?.message ?? buildUserPrompt(question);
	const workspace = createImproveQuestionsWorkspace({ questions: [question] });
	const toolNamesById = new Map<string, string>();
	const toolFailureMessages: string[] = [];
	let hasSuccessfulUpdate = false;
	let toolsComplete = false;

	const baseMeta = { questionId: question.id };
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
				id: number;
				updatedFields: string[];
			};
			options.onWorkspaceUpdate?.({
				question: workspace.getQuestion(content.id),
				updatedFields: content.updatedFields,
			});
		}
	};

	const workspaceTools = createImproveQuestionsTools(workspace, {
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
	const externalTools = wrapToolSetWithExecutionHook(
		options.tools ?? {},
		async ({ toolCallId, toolName, output }) => {
			toolNamesById.set(toolCallId, toolName);
			const payload = payloadFromToolExecuteResult(toolCallId, output);
			handleToolResult({
				toolCallId,
				content: payload.content,
				error: payload.error,
				state: payload.state,
			});
		},
	);
	const combinedTools: ToolSet = {
		...workspaceTools,
		...externalTools,
	};

	const conversationMessages = followUp
		? [
				...followUp.history.map((entry) => ({
					role: entry.role,
					content: entry.content,
				})),
				{ role: "user" as const, content: followUp.message },
			]
		: [{ role: "user" as const, content: userPrompt }];

	const hasWorkspaceUpdate = () => {
		if (hasSuccessfulUpdate) return true;
		const improved = workspace.getQuestion(question.id);
		return (
			improved.question !== question.question ||
			improved.options.join("\0") !== question.options.join("\0") ||
			improved.answers.join("\0") !== question.answers.join("\0") ||
			improved.explanation !== question.explanation
		);
	};

	const collectUpdatedFields = (
		before: DraftQuestion,
		after: DraftQuestion,
	): string[] => {
		const fields: string[] = [];
		if (after.question !== before.question) fields.push("question");
		if (after.options.join("\0") !== before.options.join("\0")) {
			fields.push("options");
		}
		if (after.answers.join("\0") !== before.answers.join("\0")) {
			fields.push("answer");
		}
		if (after.explanation !== before.explanation) {
			fields.push("explanation");
		}
		return fields;
	};

	const pipelineResult = await runPipelineToolAgent({
		scope: "improve-questions",
		stageId: IMPROVE_QUESTIONS_STAGE_ID,
		config: providerConfig,
		run,
		emit,
		systemPrompt,
		messages: conversationMessages,
		tools: combinedTools,
		stopWhen: buildImproveQuestionsStopWhen(IMPROVE_QUESTIONS_MAX_STEPS),
		prepareStep: buildImproveQuestionsPrepareStep(() => toolsComplete),
		meta: baseMeta,
		requestSummary: isFollowUp
			? `questionId=${question.id} followUp`
			: `questionId=${question.id}`,
		includePromptsInPending: !isFollowUp,
		isSuccess: ({ toolFailureMessages }) => {
			if (hasSuccessfulUpdate || hasWorkspaceUpdate()) return true;
			return toolFailureMessages.length === 0;
		},
		failureReason: ({ toolFailureMessages }) =>
			toolFailureMessages[0] ??
			"Improve-options agent could not apply a valid update.",
	});

	if (!pipelineResult.success) {
		const message = pipelineResult.reason ?? "unknown error";
		console.error(
			`[${new Date().toISOString()} ERROR improve-questions] ` +
				`Improve Q${question.id} failed: ${message}`,
			`question="${question.question.slice(0, 120)}..."`,
			`topic=${question.topic ?? "General"}`,
		);

		return {
			question,
			agentRun: buildAgentRunSummary({
				agentRunId,
				label,
				status: "error",
				systemPrompt,
				userPrompt,
				rawText: pipelineResult.rawText,
				error: message,
				meta: baseMeta,
			}),
			success: false,
			reason: message,
		};
	}

	const improvedQuestion = readImprovedQuestion(workspace, question.id);
	const updatedFields = collectUpdatedFields(question, improvedQuestion);
	if (updatedFields.length > 0) {
		options.onWorkspaceUpdate?.({
			question: improvedQuestion,
			updatedFields,
		});
	}

	emit({
		eventType: "result",
		stageId: run.stageId,
		agentRunId: run.agentRunId,
		label: run.label,
		finalObject: improvedQuestion,
		rawText: pipelineResult.rawText,
		meta: baseMeta,
	});

	return {
		question: improvedQuestion,
		agentRun: buildAgentRunSummary({
			agentRunId,
			label,
			status: "done",
			systemPrompt,
			userPrompt,
			rawText: pipelineResult.rawText,
			finalObject: improvedQuestion,
			meta: baseMeta,
		}),
		success: true,
	};
}

function buildAgentRunSummary(
	summary: ImproveQuestionsAgentRunSummary,
): ImproveQuestionsAgentRunSummary {
	return summary;
}

function readImprovedQuestion(
	workspace: ReturnType<typeof createImproveQuestionsWorkspace>,
	questionId: number,
): DraftQuestion {
	const improved = workspace.getQuestion(questionId);
	return improved;
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
	if (toolName !== UPDATE_QUESTION_OPTIONS_TOOL) return false;
	if (typeof result !== "object" || result === null) return false;
	return (result as { ok?: unknown }).ok === true;
}
