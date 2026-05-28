import { z } from 'zod';
import type { ProviderConfig } from '../../validation';
import { generateJson } from '../ai';

const explanationBatchSchema = z.object({
  questions: z.array(
    z.object({
      id: z.number().int().positive(),
      explanation: z.string().min(1),
      deepExplanation: z.string().min(1),
    }),
  ),
});

type ExplanationBatchResult = z.infer<typeof explanationBatchSchema>;

export interface ExplanationBatchInput {
  id: number;
  question: string;
  options: string[];
  answer: string;
  topic?: string;
  explanation?: string;
}

function buildSystemPrompt(memoryContext?: string) {
  const basePrompt = `You are a study-coach agent that writes high-quality learning explanations for exam questions.

Output contract:
- Return ONLY valid JSON with this exact shape:
  {
    "questions": [
      {
        "id": number,
        "explanation": string,
        "deepExplanation": string
      }
    ]
  }
- Preserve the same ids from input.
- Keep the same language used by each question.

Writing rules:
- "explanation": concise and direct (1-3 sentences) focused on why the answer is correct.
- "deepExplanation": more complete teaching note (120-220 words), include reasoning steps and one practical memory hint.
- If the current explanation is already good, improve clarity instead of rewriting radically.
- Do not invent facts not implied by the question/context.
- Never include markdown, lists, or extra keys.`;

  if (!memoryContext) {
    return basePrompt;
  }

  return `${basePrompt}

Use this student memory context to adapt teaching style and emphasis. Do not quote this context in output.

${memoryContext}`;
}

export async function generateQuestionExplanationsBatch(
  config: ProviderConfig,
  questions: ExplanationBatchInput[],
  memoryContext?: string,
): Promise<ExplanationBatchResult['questions']> {
  const system = buildSystemPrompt(memoryContext);
  const prompt = `Generate explanation and deepExplanation for each question below.

Questions input:
${JSON.stringify(questions, null, 2)}`;

  const result = await generateJson<ExplanationBatchResult>(
    config,
    prompt,
    explanationBatchSchema,
    { system },
  );

  return result.questions;
}
