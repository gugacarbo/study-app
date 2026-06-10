import type { UIMessage } from "@tanstack/ai-client";
import type {
	ChangeDecision,
	QuestionChange,
} from "@/features/ai/agents/improve-options/contracts";
import type { QuestionData } from "@/features/exams/components/detail/exam-utils";

export type ImproveOptionsAgentStatus = "idle" | "running" | "done" | "error";

export interface ImproveOptionsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	question: QuestionData;
	draftQuestion: QuestionData;
	messages: UIMessage[];
	isStreaming: boolean;
	agentStatus: ImproveOptionsAgentStatus;
	changes: QuestionChange[];
	onDecision: (id: string, decision: ChangeDecision) => void;
	onKeepAll: () => void;
	onRevertAll: () => void;
	onApply: () => void;
	onCancel: () => void;
	applying: boolean;
}
