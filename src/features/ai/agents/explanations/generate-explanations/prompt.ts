import type { ExplanationBatchInput } from "./types";

export function buildUserPrompt(questions: ExplanationBatchInput[]): string {
	return `Generate explanation and deepExplanation for each question below.

Questions input:
${JSON.stringify(questions, null, 2)}`;
}
