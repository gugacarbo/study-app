import type { ExplanationBatchInput } from "./types";

function formatAnswersSnapshot(answers: string[]): string {
	if (answers.length === 0) return "(none)";
	if (answers.length === 1) return answers[0];
	return answers.map((answer, index) => `${index + 1}. ${answer}`).join("; ");
}

export function buildExplanationUserPrompt(
	question: ExplanationBatchInput,
	index: number,
): string {
	const scoringMode = question.scoringMode ?? "exact";
	const multiAnswer = question.answers.length > 1;

	return [
		`Write explanation and deepExplanation for question #${index + 1}.`,
		`The question already exists in the workspace as questionId ${question.id}.`,
		"",
		"Workflow:",
		"- Call update_question_explanation with questionId, explanation, and deepExplanation.",
		"- The snapshot below already has the stem and correct answer(s); you do not need list_explanation_questions first.",
		"- Every call must include questionId, explanation, and deepExplanation.",
		"- Call update_question_explanation exactly once, then stop.",
		"- Do not call list_explanation_questions or update_question_explanation repeatedly.",
		...(multiAnswer
			? [
					"- This question has multiple correct answers — cover each one in both fields.",
				]
			: []),
		"",
		"Question snapshot:",
		`Stem: ${question.question}`,
		`Correct answer(s): ${formatAnswersSnapshot(question.answers)}`,
		`Scoring mode: ${scoringMode}`,
		"",
		"Example call:",
		`update_question_explanation({"questionId":${question.id},"explanation":"Short why the correct answer(s) are right.","deepExplanation":"Longer teaching note with steps and a memory hint."})`,
	].join("\n");
}
