import type { DraftQuestion } from "./contracts";
import basePrompt from "./improve-questions.md?raw";

export function buildImproveQuestionsSystemPrompt(question: DraftQuestion): string {
	const topic = question.topic?.trim() || "General";
	const optionCount = question.options.length;
	const needsMoreOptions = optionCount < 5;

	const sections = [
		basePrompt.trim(),
		`
Question context:
- Topic: ${topic}
- Current option count: ${optionCount}${needsMoreOptions ? " (below minimum — expand to at least 5)" : ""}
- Question id in workspace: ${question.id}`,
	];

	return sections.join("\n");
}
