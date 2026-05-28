import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { DBQueries } from '../db/queries';
import { getDB } from './db';

export const getExamDetail = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      id: z.coerce.number().int().positive(),
    }),
  )
  .handler(async (ctx) => {
    const db = await getDB(ctx);
    if (!db) throw new Error('D1 database not available');

    const queries = new DBQueries(db);
    const exam = await queries.getExamFull(ctx.data.id);
    if (!exam) throw new Error('Exam not found');
    return exam;
  });

export const getExamsDetailed = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const db = await getDB(ctx);
  if (!db) throw new Error('D1 database not available');

  const queries = new DBQueries(db);
  return await queries.getExamsDetailed();
});

export const deleteExam = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.number(),
    }),
  )
  .handler(async (ctx) => {
    const db = await getDB(ctx);
    if (!db) throw new Error('D1 database not available');

    const queries = new DBQueries(db);
    await queries.deleteExam(ctx.data.id);
    return { success: true };
  });

export const updateQuestion = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.number(),
      question: z.string().min(1).optional(),
      options: z.array(z.string()).min(2).optional(),
      answer: z.string().min(1).optional(),
      explanation: z.string().optional(),
      topic: z.string().optional(),
    }),
  )
  .handler(async (ctx) => {
    const db = await getDB(ctx);
    if (!db) throw new Error('D1 database not available');

    const queries = new DBQueries(db);
    await queries.updateQuestion(ctx.data.id, ctx.data);
    return { success: true };
  });

export const deleteQuestion = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.number(),
    }),
  )
  .handler(async (ctx) => {
    const db = await getDB(ctx);
    if (!db) throw new Error('D1 database not available');

    const queries = new DBQueries(db);
    await queries.deleteQuestion(ctx.data.id);
    return { success: true };
  });
