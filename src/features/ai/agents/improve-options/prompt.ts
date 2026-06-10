import type { DraftQuestion } from "./contracts";

function formatOptionsSnapshot(options: string[]): string {
	return options
		.map((option, optionIndex) => {
			const label = String.fromCharCode(65 + optionIndex);
			return `  ${label}) ${option}`;
		})
		.join("\n");
}

export function buildUserPrompt(question: DraftQuestion): string {
	const topic = question.topic?.trim() || "General";
	const explanation =
		question.explanation.trim().length > 0
			? question.explanation
			: "(empty — add a helpful explanation if you change options or the answer)";

	return [
		`Improve options for question #${question.id}.`,
		`The question already exists in the workspace with id ${question.id}.`,
		"",
		"Workflow:",
		"- Inspect the workspace with get_question.",
		"- Improve distractors, ensure at least 5 options, and refine explanation/answer if needed.",
		"- Call update_question_options only for fields that need improvement. Omit unchanged fields; never pass null.",
		"- Use web_search/web_fetch when factual context is missing or uncertain.",
		"- End with a brief plain-text summary of what you did (or that no changes were needed).",
		"",
		"Current snapshot:",
		`Stem: ${question.question}`,
		"Options:",
		formatOptionsSnapshot(question.options),
		`Answers: ${question.answers.join("; ")}`,
		`Scoring mode: ${question.scoringMode}`,
		`Explanation: ${explanation}`,
		`Topic: ${topic}`,
	].join("\n");
}
