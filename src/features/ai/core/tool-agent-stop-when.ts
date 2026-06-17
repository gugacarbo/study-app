import {
	type PrepareStepFunction,
	type StopCondition,
	stepCountIs,
	type ToolSet,
} from "ai";
import {
	CHAT_READ_ONLY_LIST_TOOLS,
	shouldDisableChatListToolAfterResult,
} from "@/features/ai/lib/chat-tool-call-guards";
import { INGEST_STAGE_STATUS_TOOL } from "@/features/ai/tools/ingest-stage-status";

function readToolOutput(output: unknown): Record<string, unknown> | null {
	if (typeof output !== "object" || output === null) return null;
	return output as Record<string, unknown>;
}

function lastStepToolResults(
	steps: Array<{ toolResults: Array<{ toolName: string; output: unknown }> }>,
) {
	return steps.at(-1)?.toolResults ?? [];
}

function toolResultMatches(
	toolName: string,
	predicate: (output: Record<string, unknown>) => boolean,
): StopCondition<ToolSet> {
	return ({ steps }) =>
		lastStepToolResults(steps).some((result) => {
			if (result.toolName !== toolName) return false;
			const output = readToolOutput(result.output);
			return output != null && predicate(output);
		});
}

export function repeatedToolCallInLastSteps(
	toolName: string,
	stepCount = 2,
): StopCondition<ToolSet> {
	return ({ steps }) => {
		if (steps.length < stepCount) return false;

		return steps
			.slice(-stepCount)
			.every((step) =>
				step.toolResults.some((result) => result.toolName === toolName),
			);
	};
}

export function buildChatStopWhen(maxSteps = 10) {
	return [stepCountIs(maxSteps)] satisfies Array<StopCondition<ToolSet>>;
}

export function buildChatPrepareStep(
	availableToolNames: readonly string[],
): PrepareStepFunction<ToolSet> {
	const readOnlyListTools = new Set<string>(CHAT_READ_ONLY_LIST_TOOLS);

	return ({ steps }) => {
		const disabledListTools = new Set<string>();

		for (const step of steps) {
			for (const result of step.toolResults) {
				if (!readOnlyListTools.has(result.toolName)) continue;
				if (
					shouldDisableChatListToolAfterResult(result.toolName, result.output)
				) {
					disabledListTools.add(result.toolName);
				}
			}
		}

		if (disabledListTools.size === 0) return {};

		const activeTools = availableToolNames.filter(
			(name) => !disabledListTools.has(name),
		);

		return activeTools.length > 0 ? { activeTools } : {};
	};
}

function repeatedSuccessfulToolCallInLastSteps(
	toolName: string,
	stepCount = 2,
): StopCondition<ToolSet> {
	return ({ steps }) => {
		if (steps.length < stepCount) return false;

		return steps.slice(-stepCount).every((step) =>
			step.toolResults.some((result) => {
				if (result.toolName !== toolName) return false;
				const output = readToolOutput(result.output);
				return output?.ok === true;
			}),
		);
	};
}

export function buildPostUpdatePrepareStep(
	shouldFinalize: () => boolean,
): PrepareStepFunction<ToolSet> {
	return () =>
		shouldFinalize() ? { activeTools: [INGEST_STAGE_STATUS_TOOL] } : {};
}

export const ingestStageStatusReported = toolResultMatches(
	INGEST_STAGE_STATUS_TOOL,
	(output) => output.ok === true,
);

export const ingestExtractionDuplicateAddDetected = toolResultMatches(
	"add_extracted_question",
	(output) => output.alreadyExists === true,
);

export function ingestExtractionTargetReached(
	expectedQuestionCount: number,
): StopCondition<ToolSet> {
	return ({ steps }) => {
		const lastStep = steps.at(-1);
		if (!lastStep) return false;

		return lastStep.toolResults.some((result) => {
			if (result.toolName !== "add_extracted_question") return false;
			const output = readToolOutput(result.output);
			return (
				output?.ok === true &&
				output.alreadyExists !== true &&
				typeof output.totalQuestions === "number" &&
				output.totalQuestions >= expectedQuestionCount
			);
		});
	};
}

export function buildExtractionPrepareStep(
	workspace: { listQuestions(): unknown[] },
	options?: {
		expectedQuestionCount?: number;
		shouldFinalize?: () => boolean;
	},
): PrepareStepFunction<ToolSet> {
	return () => {
		if (options?.shouldFinalize?.()) {
			return { activeTools: [INGEST_STAGE_STATUS_TOOL] };
		}

		const expectedQuestionCount = options?.expectedQuestionCount;
		if (expectedQuestionCount == null) return {};

		if (workspace.listQuestions().length >= expectedQuestionCount) {
			return { activeTools: [INGEST_STAGE_STATUS_TOOL] };
		}

		return {};
	};
}

export function buildIngestExtractionStopWhen(
	maxSteps: number,
	options?: { expectedQuestionCount?: number },
) {
	const conditions: Array<StopCondition<ToolSet>> = [
		stepCountIs(maxSteps),
		ingestExtractionDuplicateAddDetected,
		repeatedToolCallInLastSteps("list_extracted_questions"),
	];

	if (options?.expectedQuestionCount != null) {
		conditions.push(
			ingestExtractionTargetReached(options.expectedQuestionCount),
		);
	}

	return conditions;
}

export function buildIngestReviewStopWhen(maxSteps: number) {
	return [
		stepCountIs(maxSteps),
		ingestReviewUpdateNoOpDetected,
		repeatedSuccessfulToolCallInLastSteps("update_extracted_question"),
	] satisfies Array<StopCondition<ToolSet>>;
}

function stepUsedTool(
	steps: Array<{ toolResults: Array<{ toolName: string }> }>,
	toolName: string,
): boolean {
	return steps.some((step) =>
		step.toolResults.some((result) => result.toolName === toolName),
	);
}

export function buildIngestReviewPrepareStep(options: {
	shouldFinalize: () => boolean;
}): PrepareStepFunction<ToolSet> {
	return ({ steps }) => {
		if (options.shouldFinalize()) {
			return { activeTools: [INGEST_STAGE_STATUS_TOOL] };
		}

		if (stepUsedTool(steps, "update_extracted_question")) {
			return { activeTools: [INGEST_STAGE_STATUS_TOOL] };
		}

		return {};
	};
}

export function buildIngestExplanationStopWhen(maxSteps: number) {
	return [stepCountIs(maxSteps)] satisfies Array<StopCondition<ToolSet>>;
}

export function buildImproveQuestionsStopWhen(maxSteps: number) {
	return [stepCountIs(maxSteps)] satisfies Array<StopCondition<ToolSet>>;
}

export const ingestReviewUpdateNoOpDetected = toolResultMatches(
	"update_extracted_question",
	(output) =>
		output.ok === true &&
		Array.isArray(output.updatedFields) &&
		output.updatedFields.length === 0,
);
