import type { QuestionChange } from "@/features/ai/agents/improve-questions/contracts";
import type { AgentRunState } from "@/features/ai/pipeline/client";
import type { QuestionData } from "@/features/exams/components/detail/exam-utils";

export type ImproveQuestionsRunPhase =
	| "idle"
	| "running"
	| "done"
	| "error"
	| "canceled";

export interface ImproveQuestionsRun {
	questionId: number;
	examId: number;
	originalSnapshot: QuestionData;
	draftQuestion: QuestionData;
	agentRunState: AgentRunState | null;
	changes: QuestionChange[];
	isStreaming: boolean;
	streamError: string | null;
	phase: ImproveQuestionsRunPhase;
}

export interface ImproveQuestionsStoreState {
	runs: Record<number, ImproveQuestionsRun>;
}
