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
		`Improve question #${question.id}.`,
		`The question already exists in the workspace with id ${question.id}.`,
		"",
		"Workflow:",
		"- The snapshot below already has the current stem, options, answers, and explanation.",
		"- Improve unclear stems, weak distractors, option count below 5, and explanation/answers when needed.",
		"- Call update_question_options only for fields that need improvement. Omit unchanged fields; never pass null.",
		"- Call update_question_options at most once with real changes, then stop.",
		"- Use get_question only if you truly need to re-read the workspace.",
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
