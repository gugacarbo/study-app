import {
	stepCountIs,
	type PrepareStepFunction,
	type StopCondition,
	type ToolSet,
} from "ai";
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

export function toolResultMatches(
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

export function repeatedSuccessfulToolCallInLastSteps(
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

function workspaceUpdateSucceeded(updateToolName: string): StopCondition<ToolSet> {
	return toolResultMatches(
		updateToolName,
		(output) =>
			output.ok === true &&
			Array.isArray(output.updatedFields) &&
			output.updatedFields.length > 0,
	);
}

function workspaceUpdateNoOp(updateToolName: string): StopCondition<ToolSet> {
	return toolResultMatches(
		updateToolName,
		(output) =>
			output.ok === true &&
			Array.isArray(output.updatedFields) &&
			output.updatedFields.length === 0,
	);
}

export function buildWorkspaceAgentStopWhen(
	maxSteps: number,
	options: {
		updateToolName: string;
		readToolNames?: string[];
		stopOnRepeatedUpdate?: boolean;
	},
) {
	const conditions: Array<StopCondition<ToolSet>> = [
		stepCountIs(maxSteps),
		workspaceUpdateSucceeded(options.updateToolName),
		workspaceUpdateNoOp(options.updateToolName),
	];

	for (const readToolName of options.readToolNames ?? []) {
		conditions.push(repeatedToolCallInLastSteps(readToolName));
	}

	if (options.stopOnRepeatedUpdate !== false) {
		conditions.push(
			repeatedSuccessfulToolCallInLastSteps(options.updateToolName),
		);
	}

	return conditions;
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
		ingestStageStatusReported,
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
		ingestStageStatusReported,
	] satisfies Array<StopCondition<ToolSet>>;
}

export function buildIngestReviewPrepareStep(options: {
	shouldFinalize: () => boolean;
	listCallCount: () => number;
}): PrepareStepFunction<ToolSet> {
	return () => {
		if (options.shouldFinalize()) {
			return { activeTools: [INGEST_STAGE_STATUS_TOOL] };
		}

		if (options.listCallCount() >= 1) {
			return {
				activeTools: [
					"update_extracted_question",
					INGEST_STAGE_STATUS_TOOL,
				],
			};
		}

		return {};
	};
}

export function buildIngestExplanationStopWhen(maxSteps: number) {
	return [
		stepCountIs(maxSteps),
		ingestStageStatusReported,
	] satisfies Array<StopCondition<ToolSet>>;
}

export function buildImproveQuestionsStopWhen(maxSteps: number) {
	return buildWorkspaceAgentStopWhen(maxSteps, {
		updateToolName: "update_question_options",
		readToolNames: ["get_question"],
	});
}

export const ingestReviewUpdateNoOpDetected = toolResultMatches(
	"update_extracted_question",
	(output) =>
		output.ok === true &&
		Array.isArray(output.updatedFields) &&
		output.updatedFields.length === 0,
);
