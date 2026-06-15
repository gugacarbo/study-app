import type { ExplainQuestionsExamProcessView } from "@/features/background-processes";
import type { QuestionData } from "../exam-utils";

export type ExplainQuestionsAgentDisplayStatus =
	| "pending"
	| "running"
	| "done"
	| "error"
	| "canceled";

export interface ExplainQuestionsBatchAgentItem {
	processView: ExplainQuestionsExamProcessView;
	question: QuestionData;
	questionIndex: number;
	displayStatus: ExplainQuestionsAgentDisplayStatus;
}

export function mapProcessViewToDisplayStatus(
	view: ExplainQuestionsExamProcessView,
): ExplainQuestionsAgentDisplayStatus {
	if (view.status === "queued" || view.phase === "idle") return "pending";
	if (view.isStreaming || view.status === "running" || view.phase === "running") {
		return "running";
	}
	if (view.status === "success" || view.phase === "done") {
		return "done";
	}
	if (view.status === "error" || view.phase === "error") return "error";
	if (view.status === "canceled" || view.phase === "canceled") {
		return "canceled";
	}
	return "pending";
}

export function canContinueExplainQuestionsAgent(
	item: ExplainQuestionsBatchAgentItem,
): boolean {
	return (
		item.displayStatus === "error" || item.displayStatus === "canceled"
	);
}

export function explainQuestionsAgentBadgeClass(
	status: ExplainQuestionsAgentDisplayStatus,
): string {
	switch (status) {
		case "done":
			return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
		case "error":
			return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200";
		case "running":
			return "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200";
		case "canceled":
			return "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
		default:
			return "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
	}
}
