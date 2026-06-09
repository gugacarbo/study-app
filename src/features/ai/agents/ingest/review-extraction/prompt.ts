import type { Question } from "@/lib/validation";
import { extractQuestionSourceSnippet } from "./source-snippet";

function unique<T>(items: T[]): T[] {
	return Array.from(new Set(items));
}

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

const BASE_REVIEWER_SYSTEM_PROMPT = `You are a reviewer for a single extracted exam question.
Your only task is to verify and correct one question object while preserving the original language from the source text.

Tool contract:
- Use list_extracted_questions to inspect the current review workspace before making corrections.
- Use update_extracted_question only when a field actually needs correction.
- When calling update_extracted_question, include only the fields you are changing. Omit unchanged fields entirely — never send null.
- A call with only questionId and no field changes is a no-op.
- Do not return a final JSON object yourself. The server will read the final reviewed question from the workspace.
- After all tool calls, reply with a brief plain-text summary (1–3 sentences) of what you checked and what you changed, or state that no changes were needed.
- Do not output markdown, code fences, or JSON outside that final summary.

Review rules:
- Always keep "options" with at least 2 items. For open-ended questions, include the exact correct answer plus at least one short incorrect distractor.
- When you update a question, set "explanation" to "".
- Do not invent extra fields or speculative corrections.`;

export function buildReviewerSystemPrompt(reviewTopics: string[]): string {
	const sections = [BASE_REVIEWER_SYSTEM_PROMPT];

	if (reviewTopics.length > 0) {
		sections.push(`
Critical topic checks:
- Priority topics for extra care: ${reviewTopics.join(", ")}.
- If you find uncertainty in question/answer pairs for these topics, verify with web_search/web_fetch before applying corrections.
- Keep corrections faithful to the source text and avoid speculative changes.`);
	}

	return sections.join("\n");
}

export function buildReviewerUserPrompt(
	sourceText: string,
	question: Question,
	index: number,
): string {
	const sourceExcerpt = extractQuestionSourceSnippet(sourceText, question);
	const sourceSection = sourceExcerpt
		? ["Source excerpt for this question only:", sourceExcerpt]
		: [
				"No matching source excerpt was found for this question.",
				"Use list_extracted_questions for the workspace copy and web_search when a critical-topic check needs external verification.",
			];

	return [
		`Review extracted question #${index + 1}.`,
		`The question already exists in the workspace as questionId "q1".`,
		"",
		"Workflow:",
		"- Inspect the workspace with list_extracted_questions.",
		"- Compare the workspace question against the source excerpt below.",
		"- Call update_extracted_question only for fields that need correction. Omit unchanged fields; never pass null.",
		"- If the question is already correct, finish without calling update_extracted_question.",
		"- End with a brief plain-text summary of what you did (or that no changes were needed).",
		"",
		...sourceSection,
	].join("\n");
}
