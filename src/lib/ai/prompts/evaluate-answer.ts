import { z } from "zod";
import type { ProviderConfig } from "../../validation";
import { generateJson } from "../ai";

const quizEvaluationSchema = z.object({
  correct: z.boolean(),
  explanation: z.string().min(1),
});

type QuizEvaluation = z.infer<typeof quizEvaluationSchema>;

function buildSystemPrompt(memoryContext?: string) {
  if (!memoryContext) {
    return `You are a strict quiz-grading agent.
Evaluate whether the student's answer should be considered correct based only on the provided question and official correct answer.
Return valid JSON only.`;
  }

  return `You are a strict quiz-grading agent.
Evaluate whether the student's answer should be considered correct based only on the provided question and official correct answer.
Use the learning-history context only to personalize the explanation tone; never change grading criteria.
Return valid JSON only.

${memoryContext}`;
}

export async function evaluateQuizAnswer(
  config: ProviderConfig,
  input: {
    question: string;
    options: string[];
    userAnswer: string;
    correctAnswer: string;
  },
  memoryContext?: string,
): Promise<QuizEvaluation> {
  return await generateJson<QuizEvaluation>(
    config,
    `
    Evaluate the student's answer.

    Question:
    ${input.question}

    Options:
    ${input.options.map((opt, i) => `${String.fromCharCode(97 + i)}) ${opt}`).join("\n")}

    Student answer:
    ${input.userAnswer}

    Official correct answer:
    ${input.correctAnswer}

    Decision policy:
    - Mark correct=true only if the student's answer matches the official correct answer in meaning.
    - Ignore differences in case, punctuation, surrounding whitespace, and harmless wording variations.
    - If the student chose a different option/content, mark correct=false.
    - Keep explanation concise (1-3 sentences), clear, and study-oriented.

    Return JSON in this exact shape:
    {
      "correct": true,
      "explanation": "short explanation"
    }
  `,
    quizEvaluationSchema,
    { system: buildSystemPrompt(memoryContext) },
  );
}
