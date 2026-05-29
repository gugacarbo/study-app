import type { ProviderConfig } from "../../validation";
import { generateText } from "../ai";

export async function getExplanation(
	config: ProviderConfig,
	question: string,
	userAnswer: string,
	correctAnswer: string,
	isCorrect: boolean,
	memoryContext?: string,
): Promise<string> {
	const systemPrompt = memoryContext
		? `You are a helpful tutor. Explain why the answer is correct or incorrect in 2-3 sentences.
Use the following context about the student's learning history:

${memoryContext}`
		: "You are a helpful tutor. Explain why the answer is correct or incorrect in 2-3 sentences.";

	const result = await generateText(
		config,
		`
    The user answered "${userAnswer}" to the question: "${question}"
    The correct answer is: "${correctAnswer}"
    The user was ${isCorrect ? "correct" : "incorrect"}.
    Provide a brief, helpful explanation.
  `,
		{ system: systemPrompt },
	);

	return result.text;
}
