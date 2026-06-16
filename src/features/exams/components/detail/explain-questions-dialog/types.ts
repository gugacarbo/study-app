import type { ExplanationChange } from "@/features/ai/agents/explanations/explain-question/contracts";
import type { ChangeDecision } from "@/features/ai/agents/improve-questions/contracts";
import type { UIMessage } from "ai";
import type { QuestionData } from "../exam-utils";

export type ExplainQuestionsAgentStatus = "idle" | "running" | "done" | "error";

export interface ExplanationPreview {
	explanation: string;
	deepExplanation: string;
}

export interface ExplainQuestionsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	question: QuestionData;
	preview: ExplanationPreview;
	messages: UIMessage[];
	isStreaming: boolean;
	agentStatus: ExplainQuestionsAgentStatus;
	changes: ExplanationChange[];
	onDecision: (id: string, decision: ChangeDecision) => void;
	onKeepAll: () => void;
	onRevertAll: () => void;
	onApply: () => void;
	onCancel: () => void;
	onDismiss: () => void;
	onContinue: () => void;
	canContinue: boolean;
	streamError: string | null;
	applying: boolean;
}
