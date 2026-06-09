import type { ProviderConfig } from "@/lib/validation";
import { runQuestionExplanations } from "./execute";
import type {
	ExplanationAgentRunSummary,
	ExplanationBatchInput,
	ExplanationBatchResult,
	RunBatchQuestionExplanationsOptions,
} from "./types";

/** @deprecated Use runQuestionExplanations */
export async function runBatchQuestionExplanations(
	config: ProviderConfig,
	questions: ExplanationBatchInput[],
	options: RunBatchQuestionExplanationsOptions = {},
): Promise<{
	questions: ExplanationBatchResult["questions"];
	agentRuns: ExplanationAgentRunSummary[];
}> {
	const result = await runQuestionExplanations(config, questions, options);
	return {
		questions: result.questions,
		agentRuns: result.agentRuns,
	};
}

/** @deprecated Use runQuestionExplanations */
export async function generateQuestionExplanationsBatch(
	config: ProviderConfig,
	questions: ExplanationBatchInput[],
	memoryContext?: string,
): Promise<ExplanationBatchResult["questions"]> {
	const result = await runQuestionExplanations(config, questions, {
		memoryContext,
	});
	return result.questions;
}
