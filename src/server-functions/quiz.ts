import { createServerFn } from '@tanstack/react-start';
import type { D1Database } from '@cloudflare/workers-types';
import { DBQueries } from '../db/queries';
import { generateQuizQuestions, getExplanation } from '../lib/ai';
import { providerConfigSchema, type ProviderConfig } from '../lib/validation';

function getDB(): D1Database {
  return (globalThis as any).env?.DB;
}

export const generateQuiz = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: { topic?: string; count?: number; config: ProviderConfig; examId?: number } }) => {
    const validatedConfig = providerConfigSchema.parse(data.config);
    const db = getDB();
    if (!db) throw new Error('D1 database not available');

    const queries = new DBQueries(db);

    if (data.examId) {
      return await queries.getQuestionsByExam(data.examId);
    }

    const count = data.count || 10;

    if (data.topic) {
      const existing = await queries.getRandomQuestions(count, data.topic);
      if (existing.length > 0) return existing;
    }

    const topic = data.topic || 'General';
    return await generateQuizQuestions(validatedConfig, topic, count);
  }
);

export const submitAnswer = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data: { questionId: number; userAnswer: string; correctAnswer: string; question: string; config: ProviderConfig } }) => {
    const validatedConfig = providerConfigSchema.parse(data.config);
    const isCorrect = data.userAnswer === data.correctAnswer;

    const db = getDB();
    if (!db) throw new Error('D1 database not available');

    const queries = new DBQueries(db);
    await queries.recordAttempt(data.questionId, data.userAnswer, isCorrect);

    const explanation = await getExplanation(
      validatedConfig,
      data.question,
      data.userAnswer,
      data.correctAnswer,
      isCorrect
    );

    return {
      correct: isCorrect,
      explanation,
    };
  }
);
