import type { QuestionData } from "../exam-utils";
import { ImproveQuestionsDialog as ImproveQuestionsDialogView } from "./improve-questions-dialog";
import { useImproveQuestions } from "./use-improve-questions";

export interface ImproveQuestionsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	questionId: number;
	examId: number;
	question: QuestionData;
	onDraftChange?: (draft: QuestionData | null) => void;
}

export function ImproveQuestionsDialog({
	open,
	onOpenChange,
	questionId,
	examId,
	question,
}: ImproveQuestionsDialogProps) {
	const state = useImproveQuestions({
		questionId,
		examId,
		open,
		question,
		onOpenChange,
	});

	return (
		<ImproveQuestionsDialogView
			open={open}
			onOpenChange={state.onOpenChange}
			question={state.question}
			draftQuestion={state.draftQuestion}
			messages={state.messages}
			isStreaming={state.isStreaming}
			agentStatus={state.agentStatus}
			changes={state.changes}
			onDecision={state.onDecision}
			onKeepAll={state.onKeepAll}
			onRevertAll={state.onRevertAll}
			onApply={state.onApply}
			onCancel={state.onCancel}
			onDismiss={state.onDismiss}
			onContinue={state.onContinue}
			canContinue={state.canContinue}
			canSendFollowUp={state.canSendFollowUp}
			onSendFollowUp={state.onSendFollowUp}
			streamError={state.streamError}
			applying={state.applying}
		/>
	);
}
