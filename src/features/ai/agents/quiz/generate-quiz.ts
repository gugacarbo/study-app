import { generateJson } from "@/features/ai/core/generate";
import type { ProviderConfig, Question } from "@/lib/validation";
import { questionSchema } from "@/lib/validation";
import { buildQuizSystemPrompt } from "./system-prompt";

export async function generateQuizQuestions(
	config: ProviderConfig,
	topic: string,
	count: number = 10,
	memoryContext?: string,
): Promise<Question[]> {
	const systemPrompt = buildQuizSystemPrompt(memoryContext);

	return await generateJson<Question[]>(
		config,
		`
    Generate ${count} multiple-choice questions about: ${topic}
    Return ONLY a valid JSON array with this exact structure:
    [
      {
        "question": "the question text",
        "options": ["option a", "option b", "option c", "option d"],
        "answers": ["the correct answer text"],
        "scoringMode": "exact",
        "explanation": "brief explanation",
        "topic": "${topic}"
      }
    ]
  `,
		questionSchema.array(),
		{ system: systemPrompt },
	);
}
