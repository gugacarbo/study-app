import type { QuestionChange } from "@/features/ai/agents/improve-options/contracts";
import type { AgentRunState } from "@/features/ai/utils/agent-run-messages";
import type { QuestionData } from "@/features/exams/components/detail/exam-utils";

export type ImproveOptionsRunPhase =
	| "idle"
	| "running"
	| "done"
	| "error"
	| "canceled";

export interface ImproveOptionsRun {
	questionId: number;
	examId: number;
	originalSnapshot: QuestionData;
	draftQuestion: QuestionData;
	agentRunState: AgentRunState | null;
	changes: QuestionChange[];
	isStreaming: boolean;
	streamError: string | null;
	phase: ImproveOptionsRunPhase;
}

export interface ImproveOptionsStoreState {
	runs: Record<number, ImproveOptionsRun>;
}
