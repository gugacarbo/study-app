import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { DBQueries } from '../db/queries';
import { getDB } from './db';
import { generateQuizQuestions } from '../lib/ai/prompts/generate-quiz';
import { evaluateQuizAnswer } from '../lib/ai/prompts/evaluate-answer';
import { providerConfigSchema } from '../lib/validation';
import { getMemoryContext } from './memory';

const generateQuizSchema = z.object({
  topic: z.string().optional(),
  count: z.number().optional(),
  config: providerConfigSchema,
  examId: z.number().optional(),
});

const submitAnswerSchema = z.object({
  questionId: z.number(),
  userAnswer: z.string(),
  question: z.string(),
  config: providerConfigSchema,
});

export const generateQuiz = createServerFn({ method: 'POST' })
  .inputValidator(generateQuizSchema)
  .handler(async (ctx) => {
    const { data } = ctx;
    const db = await getDB(ctx);
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

    const memoryResult = await getMemoryContext({ data: { topics: [topic] } }).catch(() => ({ context: '' }));
    return await generateQuizQuestions(data.config, topic, count, memoryResult.context || undefined);
  });

export const submitAnswer = createServerFn({ method: 'POST' })
  .inputValidator(submitAnswerSchema)
  .handler(async (ctx) => {
    const { data } = ctx;

    const db = await getDB(ctx);
    if (!db) throw new Error('D1 database not available');

    const queries = new DBQueries(db);
    const storedQuestion = await queries.getQuestionById(data.questionId);
    if (!storedQuestion) {
      throw new Error('Question not found');
    }

    const memoryTopic = storedQuestion.topic || data.question;
    const memoryResult = await getMemoryContext({ data: { topics: [memoryTopic] } }).catch(() => ({ context: '' }));

    const evaluation = await evaluateQuizAnswer(
      data.config,
      {
        question: storedQuestion.question,
        options: storedQuestion.options,
        userAnswer: data.userAnswer,
        correctAnswer: storedQuestion.answer,
      },
      memoryResult.context || undefined,
    );

    await queries.recordAttempt(data.questionId, data.userAnswer, evaluation.correct);

    return {
      correct: evaluation.correct,
      explanation: evaluation.explanation,
    };
  });
