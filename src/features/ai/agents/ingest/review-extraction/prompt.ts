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
		"Use list_extracted_questions to inspect the current review workspace before making corrections.",
		"Use update_extracted_question only when a field actually needs correction.",
		"When using update_extracted_question, include only the fields you are changing. Omit unchanged fields entirely — never send null.",
		"Do not return a final JSON object yourself. The server will read the final reviewed question from the workspace.",
		'Always keep "options" with at least 2 items. For open-ended questions, include the exact correct answer plus at least one short incorrect distractor.',
		'When you update a question, set "explanation" to "".',
		"Do not invent extra fields or commentary unless it is strictly necessary for the tool workflow.",
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
- The current question already exists in the workspace as questionId \"q1\".
- Inspect the workspace with list_extracted_questions.
- Call update_extracted_question only for fields that need correction. Omit unchanged fields; never pass null.
- If the current question is already correct, finish without calling update_extracted_question.`;
}
