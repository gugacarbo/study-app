import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { DBQueries } from '../db/queries';
import { getDB } from './db';
import { generateQuizQuestions, getExplanation } from '../lib/ai';
import { providerConfigSchema } from '../lib/validation';

const generateQuizSchema = z.object({
  topic: z.string().optional(),
  count: z.number().optional(),
  config: providerConfigSchema,
  examId: z.number().optional(),
});

const submitAnswerSchema = z.object({
  questionId: z.number(),
  userAnswer: z.string(),
  correctAnswer: z.string(),
  question: z.string(),
  config: providerConfigSchema,
});

export const generateQuiz = createServerFn({ method: 'POST' })
  .inputValidator(generateQuizSchema)
  .handler(async (ctx) => {
    const { data } = ctx;
    const db = getDB(ctx);
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
    return await generateQuizQuestions(data.config, topic, count);
  });

export const submitAnswer = createServerFn({ method: 'POST' })
  .inputValidator(submitAnswerSchema)
  .handler(async (ctx) => {
    const { data } = ctx;
    const isCorrect = data.userAnswer === data.correctAnswer;

    const db = getDB(ctx);
    if (!db) throw new Error('D1 database not available');

    const queries = new DBQueries(db);
    await queries.recordAttempt(data.questionId, data.userAnswer, isCorrect);

    const explanation = await getExplanation(
      data.config,
      data.question,
      data.userAnswer,
      data.correctAnswer,
      isCorrect
    );

    return {
      correct: isCorrect,
      explanation,
    };
  });
