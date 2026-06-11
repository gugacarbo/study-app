import type { UIMessage } from "@tanstack/ai-client";
import type {
	ChangeDecision,
	QuestionChange,
} from "@/features/ai/agents/improve-questions/contracts";
import type { QuestionData } from "@/features/exams/components/detail/exam-utils";

export type ImproveQuestionsAgentStatus = "idle" | "running" | "done" | "error";

export interface ImproveQuestionsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	question: QuestionData;
	draftQuestion: QuestionData;
	messages: UIMessage[];
	isStreaming: boolean;
	agentStatus: ImproveQuestionsAgentStatus;
	changes: QuestionChange[];
	onDecision: (id: string, decision: ChangeDecision) => void;
	onKeepAll: () => void;
	onRevertAll: () => void;
	onApply: () => void;
	onCancel: () => void;
	onContinue: () => void;
	canContinue: boolean;
	applying: boolean;
}
