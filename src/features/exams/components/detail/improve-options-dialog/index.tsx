import { useEffect } from "react";
import { ImproveOptionsDialog as ImproveOptionsDialogView } from "./improve-options-dialog";
import type { QuestionData } from "../exam-utils";
import { useImproveOptions } from "./use-improve-options";

export interface ImproveOptionsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	questionId: number;
	examId: number;
	question: QuestionData;
	onDraftChange?: (draft: QuestionData | null) => void;
}

export function ImproveOptionsDialog({
	open,
	onOpenChange,
	questionId,
	examId,
	question,
	onDraftChange,
}: ImproveOptionsDialogProps) {
	const state = useImproveOptions({
		questionId,
		examId,
		open,
		question,
		onOpenChange,
	});

	useEffect(() => {
		if (!open) {
			onDraftChange?.(null);
			return;
		}
		onDraftChange?.(state.draftQuestion);
	}, [open, state.draftQuestion, onDraftChange]);

	return (
		<ImproveOptionsDialogView
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
			applying={state.applying}
		/>
	);
}
