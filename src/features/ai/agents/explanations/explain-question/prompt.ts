export function buildExplainQuestionUserPrompt(
	questionId: number,
	options?: { overwrite?: boolean },
): string {
	const overwrite = options?.overwrite ?? false;

	return [
		`Write or improve explanations for question id ${questionId}.`,
		"",
		"Workflow:",
		"- Call get_question first to load the full question snapshot and any existing explanations.",
		overwrite
			? "- Overwrite mode is enabled: review existing explanations and rewrite or improve them as needed."
			: "- If explanation and deepExplanation are already complete, review and improve clarity only where needed.",
		"- Use web_search and web_fetch when factual context would improve the explanation.",
		"- Call update_question_explanation exactly once with questionId, explanation, and deepExplanation.",
		"- Do not call get_question or update_question_explanation repeatedly.",
		"",
		"Example call:",
		`update_question_explanation({"questionId":${questionId},"explanation":"Short why the correct answer(s) are right.","deepExplanation":"Longer teaching note with steps and a memory hint."})`,
	].join("\n");
}
