import type { ExplanationBatchInput } from "./types";

export function buildExplanationUserPrompt(
	question: ExplanationBatchInput,
	index: number,
): string {
	return [
		`Write explanation and deepExplanation for question #${index + 1}.`,
		`The question already exists in the workspace as questionId ${question.id}.`,
		"",
		"Workflow:",
		"- Inspect the workspace with list_explanation_questions.",
		"- Call update_question_explanation with questionId, explanation, and deepExplanation.",
		"- Every call must include questionId, explanation, and deepExplanation.",
		"- Finish only after the workspace shows hasExplanation and hasDeepExplanation true.",
		"",
		"Example call:",
		`update_question_explanation({"questionId":${question.id},"explanation":"Short why the answer is correct.","deepExplanation":"Longer teaching note with steps and a memory hint."})`,
		"",
		"Question input (the workspace is the source of truth):",
		JSON.stringify(question, null, 2),
	].join("\n");
}
