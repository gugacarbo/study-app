import type { ProviderConfig, Question } from "../../validation";
import { questionSchema } from "../../validation";
import { generateJson } from "../ai";

export async function generateQuizQuestions(
  config: ProviderConfig,
  topic: string,
  count: number = 10,
  memoryContext?: string,
): Promise<Question[]> {
  const systemPrompt = memoryContext
    ? `You are a helpful assistant that generates exam questions. Always return valid JSON.
Use the following context about the student's learning history to personalize questions:

${memoryContext}`
    : "You are a helpful assistant that generates exam questions. Always return valid JSON.";

  const parsed = await generateJson<unknown>(
    config,
    `
    Generate ${count} multiple-choice questions about: ${topic}
    Return ONLY a valid JSON array with this exact structure:
    [
      {
        "question": "the question text",
        "options": ["option a", "option b", "option c", "option d"],
        "answer": "the correct answer text",
        "explanation": "brief explanation",
        "topic": "${topic}"
      }
    ]
  `,
    { system: systemPrompt },
  );

  const validated = questionSchema.array().parse(parsed);
  return validated;
}
