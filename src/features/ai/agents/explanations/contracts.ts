import type { AgentRunDataPart } from "@/features/ai/types/ui-message-data-parts";
import type { ExplanationAgentRunSummary } from "./generate-explanations/types";

export const EXPLAIN_QUESTION_STAGE_ID = "explain-question" as const;

export type ExplainQuestionAgentEvent = AgentRunDataPart & {
	stageId: typeof EXPLAIN_QUESTION_STAGE_ID;
};

export interface ExplainQuestionJobResult {
	questionId: number;
	explanation: string;
	deepExplanation: string;
	agentRun: ExplanationAgentRunSummary;
}
