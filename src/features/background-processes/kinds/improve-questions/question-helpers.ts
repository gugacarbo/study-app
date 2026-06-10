import type { DraftQuestion } from "@/features/ai/agents/improve-questions/contracts";
import type { QuestionData } from "@/features/exams/components/detail/exam-utils";
import { resolveQuestion } from "@/features/exams/components/detail/improve-questions-dialog/resolve-question";
import type { ImproveQuestionsBackgroundProcess } from "../../store/types";

type DraftLike = DraftQuestion & {
	answer?: string;
	answers?: string[];
};

export function cloneQuestion(question: QuestionData): QuestionData {
	return {
		...question,
		options: [...question.options],
		answers: [...question.answers],
	};
}

export function draftToQuestionData(
	draft: DraftLike,
	base: QuestionData,
): QuestionData {
	const answers =
		draft.answers && draft.answers.length > 0
			? [...draft.answers]
			: typeof draft.answer === "string" && draft.answer.trim()
				? [draft.answer]
				: [...base.answers];

	return {
		...base,
		id: draft.id,
		question: draft.question,
		options: [...draft.options],
		answers,
		scoringMode: draft.scoringMode ?? base.scoringMode,
		explanation: draft.explanation ?? base.explanation,
		...(draft.deepExplanation !== undefined
			? { deepExplanation: draft.deepExplanation }
			: {}),
		...(draft.topic !== undefined ? { topic: draft.topic } : {}),
	};
}

export function getRunPreviewQuestion(
	run: ImproveQuestionsBackgroundProcess,
	question: QuestionData,
): QuestionData {
	const { originalSnapshot, draftQuestion, changes } = run;
	if (changes.length === 0) {
		return draftQuestion;
	}
	return {
		...resolveQuestion(originalSnapshot, draftQuestion, changes),
		scoringMode: question.scoringMode,
		deepExplanation: question.deepExplanation,
		topic: question.topic,
		exam_id: question.exam_id,
	};
}
