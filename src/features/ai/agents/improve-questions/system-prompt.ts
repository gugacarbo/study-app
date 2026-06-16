import { IMPROVE_QUESTIONS_BASE_PROMPT } from "./base-prompt";
import type { DraftQuestion } from "./contracts";

export function buildImproveQuestionsSystemPrompt(
	question: DraftQuestion,
): string {
	const topic = question.topic?.trim() || "General";
	const optionCount = question.options.length;
	const needsMoreOptions = optionCount < 5;

	const sections = [
		IMPROVE_QUESTIONS_BASE_PROMPT.trim(),
		`
Question context:
- Topic: ${topic}
- Current option count: ${optionCount}${needsMoreOptions ? " (below minimum — expand to at least 5)" : ""}
- Question id in workspace: ${question.id}`,
	];

	return sections.join("\n");
}
