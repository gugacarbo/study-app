import type { QuestionData } from "@/features/exams/components/detail/exam-utils";
import type {
	BackgroundProcessStatus,
	BackgroundProcessStoreState,
	ExplainQuestionRunPhase,
} from "./types";
import { isExplainQuestionProcess } from "./types";

export type ExplainQuestionsExamProcessView = {
	questionId: number;
	phase: ExplainQuestionRunPhase;
	status: BackgroundProcessStatus;
	isStreaming: boolean;
	explanation: string;
	deepExplanation: string;
	originalSnapshot: QuestionData;
	agentLabel: string;
	streamError: string | null;
};

export function selectExplainQuestionsExamViews(
	state: BackgroundProcessStoreState,
	examId: number,
): ExplainQuestionsExamProcessView[] {
	const views: ExplainQuestionsExamProcessView[] = [];

	for (const process of state.processes) {
		if (!isExplainQuestionProcess(process) || process.examId !== examId) {
			continue;
		}

		views.push({
			questionId: process.questionId,
			phase: process.phase,
			status: process.status,
			isStreaming: process.isStreaming,
			explanation: process.explanation,
			deepExplanation: process.deepExplanation,
			originalSnapshot: process.originalSnapshot,
			agentLabel: process.agentRunState?.label ?? "Explain question",
			streamError: process.streamError,
		});
	}

	views.sort((left, right) => left.questionId - right.questionId);
	return views;
}

export function areExplainQuestionsExamViewsEqual(
	left: ExplainQuestionsExamProcessView[],
	right: ExplainQuestionsExamProcessView[],
): boolean {
	if (left === right) return true;
	if (left.length !== right.length) return false;

	for (let index = 0; index < left.length; index += 1) {
		const leftView = left[index];
		const rightView = right[index];
		if (
			leftView.questionId !== rightView.questionId ||
			leftView.phase !== rightView.phase ||
			leftView.status !== rightView.status ||
			leftView.isStreaming !== rightView.isStreaming ||
			leftView.explanation !== rightView.explanation ||
			leftView.deepExplanation !== rightView.deepExplanation ||
			leftView.originalSnapshot !== rightView.originalSnapshot ||
			leftView.agentLabel !== rightView.agentLabel ||
			leftView.streamError !== rightView.streamError
		) {
			return false;
		}
	}

	return true;
}
