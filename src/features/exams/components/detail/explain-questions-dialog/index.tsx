import type { QuestionData } from "../exam-utils";
import { ExplainQuestionsDialog } from "./explain-questions-dialog";
import { useExplainQuestions } from "./use-explain-questions";

interface ExplainQuestionsDialogContainerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	questionId: number;
	examId: number;
	question: QuestionData;
}

export function ExplainQuestionsDialogContainer({
	open,
	onOpenChange,
	questionId,
	examId,
	question,
}: ExplainQuestionsDialogContainerProps) {
	const state = useExplainQuestions({
		questionId,
		examId,
		open,
		question,
		onOpenChange,
	});

	return <ExplainQuestionsDialog open={open} {...state} />;
}

export { ExplainQuestionsDialog } from "./explain-questions-dialog";
export { useExplainQuestions } from "./use-explain-questions";
