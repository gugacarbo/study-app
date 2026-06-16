import type { UIMessage } from "ai";
import type {
	ChangeDecision,
	QuestionChange,
} from "@/features/ai/agents/improve-questions/contracts";
import type { QuestionData } from "@/features/exams/components/detail/exam-utils";

export type ImproveQuestionsAgentStatus = "idle" | "running" | "done" | "error";

export type ImproveQuestionsUIMessage = UIMessage;

export interface ImproveQuestionsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	question: QuestionData;
	draftQuestion: QuestionData;
	messages: ImproveQuestionsUIMessage[];
	isStreaming: boolean;
	agentStatus: ImproveQuestionsAgentStatus;
	changes: QuestionChange[];
	onDecision: (id: string, decision: ChangeDecision) => void;
	onKeepAll: () => void;
	onRevertAll: () => void;
	onApply: () => void;
	onCancel: () => void;
	onDismiss: () => void;
	onContinue: () => void;
	canContinue: boolean;
	canSendFollowUp: boolean;
	onSendFollowUp: (message: string) => void;
	streamError: string | null;
	applying: boolean;
}
