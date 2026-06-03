import type {
	ExplanationProgressItem,
	ExplanationProgressStatus,
} from "@/features/exams/components/detail/exam-utils";

interface QuestionBrief {
	id: number;
	question: string;
	explanation: string;
	deepExplanation: string;
}

export function buildProgressItems(
	questions: QuestionBrief[],
	overwriteExplanations: boolean,
): ExplanationProgressItem[] {
	return questions.map((q) => ({
		id: q.id,
		question: q.question,
		status: (overwriteExplanations ||
		!(Boolean(q.explanation?.trim()) && Boolean(q.deepExplanation?.trim()))
			? "pending"
			: "skipped") as ExplanationProgressStatus,
		message:
			overwriteExplanations ||
			!(Boolean(q.explanation?.trim()) && Boolean(q.deepExplanation?.trim()))
				? "Aguardando"
				: "Já preenchida",
	}));
}

export function computeProgressStats(items: ExplanationProgressItem[]) {
	const processingCount = items.filter((i) => i.status === "processing").length;
	const doneCount = items.filter(
		(i) => i.status === "done" || i.status === "skipped",
	).length;
	const errorCount = items.filter((i) => i.status === "error").length;
	const finishedCount = doneCount + errorCount;
	const progressPercent =
		items.length > 0 ? Math.round((finishedCount / items.length) * 100) : 0;

	return {
		processingCount,
		doneCount,
		errorCount,
		finishedCount,
		progressPercent,
	};
}
