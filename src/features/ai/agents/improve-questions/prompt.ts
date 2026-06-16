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
		"- For Portuguese text with missing accents or typos, use check_spelling when helpful, then update_question_options with the fixes.",
		"- When accents change in options, update answers in the same call so they still match options exactly.",
		"- Call update_question_options only for fields that need improvement. Omit unchanged fields; never pass null.",
		"- Use get_question when you need to re-read the workspace.",
		"- Use web_search/web_fetch when factual context is missing or uncertain.",
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
