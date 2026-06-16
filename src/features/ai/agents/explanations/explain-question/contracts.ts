import type { ToolSet } from "ai";
import type { AgentEventEmitter } from "@/features/ai/pipeline/types";
import type { AgentRunDataPart } from "@/features/ai/types/ui-message-data-parts";
import type { ChangeDecision } from "@/features/ai/agents/improve-questions/contracts";
import type { ExplanationQuestionResult } from "../generate-explanations/types";

export const EXPLAIN_QUESTION_AGENT_STAGE_ID = "explain-question" as const;

export const GET_EXPLANATION_QUESTION_TOOL = "get_question" as const;
export const UPDATE_QUESTION_EXPLANATION_TOOL = "update_question_explanation" as const;

export type ExplanationChangeField = "explanation" | "deepExplanation";

export interface ExplanationChange {
	id: string;
	field: ExplanationChangeField;
	label: string;
	before: string;
	after: string;
	decision: ChangeDecision;
}

export type ExplainQuestionAgentRunStatus =
	| "pending"
	| "running"
	| "done"
	| "error";

export interface ExplainQuestionAgentRunSummary {
	agentRunId: string;
	label: string;
	status: ExplainQuestionAgentRunStatus;
	systemPrompt: string;
	userPrompt: string;
	rawText?: string;
	finalObject?: ExplanationQuestionResult;
	error?: string;
	meta?: Record<string, unknown>;
}

export type ExplainQuestionAgentEvent = AgentRunDataPart & {
	stageId: typeof EXPLAIN_QUESTION_AGENT_STAGE_ID;
};

export interface ExplanationWorkspaceUpdateEvent {
	questionId: number;
	explanation: string;
	deepExplanation: string;
	updatedFields: ExplanationChangeField[];
}

export interface ExplainQuestionAgentJobResult {
	questionId: number;
	explanation: string;
	deepExplanation: string;
	agentRun: ExplainQuestionAgentRunSummary;
}

export interface ExplainQuestionByIdOptions {
	tools?: ToolSet;
	emit?: AgentEventEmitter;
	onAgentEvent?: (event: ExplainQuestionAgentEvent) => void;
	onWorkspaceUpdate?: (event: ExplanationWorkspaceUpdateEvent) => void;
	createAgentRunId?: (label: string) => string;
	resolveMemoryContext?: () => string | undefined;
	overwrite?: boolean;
}
