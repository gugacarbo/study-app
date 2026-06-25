import {
	resolvedExtractedQuestionSchema,
	type ResolvedExtractedQuestion,
} from "@/features/ai/jobs/ingest/extracted-question";

const LEADING_MARKER_PATTERN =
	/^(?:(?:q(?:uest[aã]o)?\s*)?\d+[\].):\-]\s*|[A-Za-z][\].):\-]\s*|[•\-–—]\s*)/i;

export function sanitizeReviewText(text: string): string {
	return text.trim().replace(LEADING_MARKER_PATTERN, "").trim();
}

export function canonicalizeReviewQuestion(
	question: ResolvedExtractedQuestion,
): ResolvedExtractedQuestion {
	const sanitizedQuestion = sanitizeReviewText(question.question);
	const keyMap = new Map<string, string>();

	const options = question.options.map((option, index) => {
		const nextKey = String.fromCharCode(65 + index);
		keyMap.set(option.key.trim(), nextKey);
		return {
			key: nextKey,
			text: sanitizeReviewText(option.text),
		};
	});

	const answers = question.answers.map((answer) => keyMap.get(answer.trim()) ?? answer.trim());

	return resolvedExtractedQuestionSchema.parse({
		question: sanitizedQuestion,
		options,
		answers,
		topic: sanitizeReviewText(question.topic),
		topicId: question.topicId,
	});
}
