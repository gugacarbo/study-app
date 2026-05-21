import { createOpenaiChatCompletions } from '@tanstack/ai-openai';
import { chat } from '@tanstack/ai';
import type { ProviderConfig, Question, ExamIngestResponse } from './validation';
import { examIngestResponseSchema, questionSchema } from './validation';

export function getAiAdapter(config: ProviderConfig) {
  const baseURL = config.baseUrl || (config.provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1'
    : undefined);

  return createOpenaiChatCompletions(config.model as any, config.apiKey, {
    baseURL,
  });
}

export async function generateText(
  config: ProviderConfig,
  prompt: string,
  options?: { json?: boolean; system?: string }
) {
  const adapter = getAiAdapter(config);

  const result = await chat({
    adapter,
    messages: [{ role: 'user', content: prompt }],
    systemPrompts: options?.system ? [options.system] : undefined,
    stream: false,
  });

  return { text: result };
}

export async function extractQuestionsFromText(
  config: ProviderConfig,
  text: string
): Promise<ExamIngestResponse> {
  const result = await generateText(config, `
    Extract all exam questions from the following text.
    Return ONLY a valid JSON object with this exact structure:
    {
      "questions": [
        {
          "question": "the question text",
          "options": ["option a", "option b", "option c", "option d"],
          "answer": "the correct answer text",
          "explanation": "brief explanation",
          "topic": "subject/topic name"
        }
      ],
      "topics": ["list", "of", "unique", "topics"]
    }

    Text to extract from:
    ${text}
  `, { json: true, system: 'You are a helpful assistant that extracts exam questions from text. Always return valid JSON.' });

  const parsed = JSON.parse(result.text);
  const validated = examIngestResponseSchema.parse(parsed);
  return validated;
}

export async function generateQuizQuestions(
  config: ProviderConfig,
  topic: string,
  count: number = 10
): Promise<Question[]> {
  const result = await generateText(config, `
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
  `, { json: true, system: 'You are a helpful assistant that generates exam questions. Always return valid JSON.' });

  const parsed = JSON.parse(result.text);
  const validated = questionSchema.array().parse(parsed);
  return validated;
}

export async function getExplanation(
  config: ProviderConfig,
  question: string,
  userAnswer: string,
  correctAnswer: string,
  isCorrect: boolean
): Promise<string> {
  const result = await generateText(config, `
    The user answered "${userAnswer}" to the question: "${question}"
    The correct answer is: "${correctAnswer}"
    The user was ${isCorrect ? 'correct' : 'incorrect'}.
    Provide a brief, helpful explanation.
  `, { system: 'You are a helpful tutor. Explain why the answer is correct or incorrect in 2-3 sentences.' });

  return result.text;
}
