import type { ExplanationAgentRunSummary } from "@/features/ai/agents/explanations";
import type { ExplanationProgressItem } from "@/features/exams/components/detail/exam-utils";
import type { ExplanationQuestionSnapshot } from "../../store/types";

export interface StartExplanationGenerationOptions {
	questions: ExplanationQuestionSnapshot[];
	batchSize?: number;
	overwriteExplanations?: boolean;
}

export interface ExplanationGenerationProcessSnapshot {
	examId: number;
	progressItems: ExplanationProgressItem[];
	agentRuns: ExplanationAgentRunSummary[];
	batchSize: number;
	overwriteExplanations: boolean;
	generationMessage: string | null;
	questions: ExplanationQuestionSnapshot[];
}

export type { ExplanationQuestionSnapshot };
