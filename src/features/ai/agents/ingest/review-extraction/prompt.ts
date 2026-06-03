import type { Question } from "@/lib/validation";

function unique<T>(items: T[]): T[] {
	return Array.from(new Set(items));
}

export { unique };

export function deriveTopics(
	questions: Question[],
	fallbackTopics: string[],
): string[] {
	const questionTopics = questions
		.map((question) => question.topic?.trim())
		.filter((topic): topic is string => Boolean(topic));

	return unique(
		[...questionTopics, ...fallbackTopics.map((topic) => topic.trim())].filter(
			Boolean,
		),
	);
}

export function buildReviewerSystemPrompt(reviewTopics: string[]): string {
	const sections = [
		"You are a reviewer for a single extracted exam question.",
		"Your only task is to verify and correct one question object while preserving the original language from the source text.",
		'Return ONLY one valid JSON object with the exact keys "question", "options", "answer", "explanation", and "topic".',
		'Always keep "options" with at least 2 items. For open-ended questions, include the exact correct answer plus at least one short incorrect distractor.',
		'Always set "explanation" to "".',
		"Do not invent extra fields or commentary.",
	];

	if (reviewTopics.length > 0) {
		sections.push(
			`Priority topics for extra care: ${reviewTopics.join(", ")}.`,
		);
	}

	return sections.join("\n");
}

export function buildReviewerUserPrompt(
	sourceText: string,
	question: Question,
	index: number,
): string {
	return `Review extracted question #${index + 1}.

Source text:
${sourceText.slice(0, 45_000)}

Current extracted question JSON:
${JSON.stringify(question)}

Task:
- Check whether the question text, options, answer, and topic are faithful to the source.
- Fix OCR issues or obvious extraction mistakes when the source supports it.
- Preserve the original language from the source text.
- Keep the structure fully compatible with the existing question schema.
- Return only the corrected JSON object.`;
}
