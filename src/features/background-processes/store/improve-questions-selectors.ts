import type { QuestionChange } from "@/features/ai/agents/improve-questions/contracts";
import type { QuestionData } from "@/features/exams/components/detail/exam-utils";
import type {
	BackgroundProcessStatus,
	BackgroundProcessStoreState,
	ImproveQuestionsRunPhase,
} from "./types";
import { isImproveQuestionsProcess } from "./types";

export type ImproveQuestionsExamProcessView = {
	questionId: number;
	phase: ImproveQuestionsRunPhase;
	status: BackgroundProcessStatus;
	isStreaming: boolean;
	draftQuestion: QuestionData;
	originalSnapshot: QuestionData;
	changes: QuestionChange[];
	agentLabel: string;
	streamError: string | null;
};

export function selectImproveQuestionsExamViews(
	state: BackgroundProcessStoreState,
	examId: number,
): ImproveQuestionsExamProcessView[] {
	const views: ImproveQuestionsExamProcessView[] = [];

	for (const process of state.processes) {
		if (!isImproveQuestionsProcess(process) || process.examId !== examId) {
			continue;
		}

		views.push({
			questionId: process.questionId,
			phase: process.phase,
			status: process.status,
			isStreaming: process.isStreaming,
			draftQuestion: process.draftQuestion,
			originalSnapshot: process.originalSnapshot,
			changes: process.changes,
			agentLabel: process.agentRunState?.label ?? "Improve question",
			streamError: process.streamError,
		});
	}

	views.sort((left, right) => left.questionId - right.questionId);
	return views;
}

function isSameQuestionChangeList(
	left: QuestionChange[],
	right: QuestionChange[],
): boolean {
	if (left === right) return true;
	if (left.length !== right.length) return false;

	for (let index = 0; index < left.length; index += 1) {
		const leftChange = left[index];
		const rightChange = right[index];
		if (
			leftChange.id !== rightChange.id ||
			leftChange.decision !== rightChange.decision
		) {
			return false;
		}
	}

	return true;
}

export function areImproveQuestionsExamViewsEqual(
	left: ImproveQuestionsExamProcessView[],
	right: ImproveQuestionsExamProcessView[],
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
			leftView.draftQuestion !== rightView.draftQuestion ||
			leftView.originalSnapshot !== rightView.originalSnapshot ||
			leftView.agentLabel !== rightView.agentLabel ||
			leftView.streamError !== rightView.streamError ||
			!isSameQuestionChangeList(leftView.changes, rightView.changes)
		) {
			return false;
		}
	}

	return true;
}
