import type { QuestionData } from "@/features/exams/components/detail/exam-utils";

export function cloneQuestion(question: QuestionData): QuestionData {
	return {
		...question,
		options: [...question.options],
		answers: [...question.answers],
	};
}

export function questionNeedsExplanation(
	question: Pick<QuestionData, "explanation" | "deepExplanation">,
	overwrite: boolean,
): boolean {
	if (overwrite) return true;
	const hasExplanation = Boolean(question.explanation?.trim());
	const hasDeepExplanation = Boolean(question.deepExplanation?.trim());
	return !hasExplanation || !hasDeepExplanation;
}
