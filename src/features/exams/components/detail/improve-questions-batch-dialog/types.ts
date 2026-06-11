import type { ImproveQuestionsBackgroundProcess } from "@/features/background-processes";
import type { QuestionData } from "../exam-utils";

export type ImproveQuestionsAgentDisplayStatus =
	| "pending"
	| "running"
	| "done"
	| "error"
	| "canceled";

export interface ImproveQuestionsBatchAgentItem {
	process: ImproveQuestionsBackgroundProcess;
	question: QuestionData;
	questionIndex: number;
	displayStatus: ImproveQuestionsAgentDisplayStatus;
}

export function mapProcessToDisplayStatus(
	process: ImproveQuestionsBackgroundProcess,
): ImproveQuestionsAgentDisplayStatus {
	if (process.status === "queued" || process.phase === "idle") return "pending";
	if (
		process.isStreaming ||
		process.status === "running" ||
		process.phase === "running"
	) {
		return "running";
	}
	if (process.status === "awaiting_review" || process.phase === "done") {
		return "done";
	}
	if (process.status === "error" || process.phase === "error") return "error";
	if (process.status === "canceled" || process.phase === "canceled") {
		return "canceled";
	}
	return "pending";
}

export function improveQuestionsAgentBadgeClass(
	status: ImproveQuestionsAgentDisplayStatus,
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
