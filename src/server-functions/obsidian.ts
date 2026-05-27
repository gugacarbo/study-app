import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { MemoryManager } from '../lib/memory';
import { ObsidianClient } from '../lib/obsidian';
import { obsidianConfigSchema, memorySessionSchema } from '../lib/validation';
import { DBQueries } from '../db/queries';
import { getDB } from './db';

function getObsidianConfig(config: Record<string, string>) {
  return {
    host: config.obsidian_host || 'localhost',
    port: Number(config.obsidian_port) || 27124,
    apiKey: config.obsidian_api_key || undefined,
    enabled: config.obsidian_enabled === 'true',
  };
}

export const getObsidianStatus = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const db = await getDB(ctx);
  if (!db) throw new Error('D1 database not available');

  const queries = new DBQueries(db);
  const config = await queries.getAllConfig();
  const obsidianConfig = getObsidianConfig(config);

  if (!obsidianConfig.enabled) {
    return { connected: false, enabled: false, message: 'Obsidian integration is disabled' };
  }

  const client = new ObsidianClient(obsidianConfig);
  const connected = await client.health();

  return {
    connected,
    enabled: true,
    host: obsidianConfig.host,
    port: obsidianConfig.port,
    message: connected ? 'Connected to Obsidian' : 'Cannot reach Obsidian REST API. Is the plugin running?',
  };
});

export const saveQuizSessionToMemory = createServerFn({ method: 'POST' })
  .inputValidator(memorySessionSchema)
  .handler(async (ctx) => {
    const { data } = ctx;
    const db = await getDB(ctx);
    if (!db) throw new Error('D1 database not available');

    const queries = new DBQueries(db);
    const config = await queries.getAllConfig();
    const obsidianConfig = getObsidianConfig(config);

    if (!obsidianConfig.enabled) {
      return { saved: false, message: 'Obsidian integration is disabled' };
    }

    const memory = new MemoryManager(obsidianConfig);
    const path = await memory.saveQuizSession(data);

    await memory.ensureStructure();

    return { saved: true, path };
  });

export const getMemoryContext = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ topics: z.array(z.string()) }))
  .handler(async (ctx) => {
    const { data } = ctx;
    const db = await getDB(ctx);
    if (!db) return { context: '' };

    const queries = new DBQueries(db);
    const config = await queries.getAllConfig();
    const obsidianConfig = getObsidianConfig(config);

    if (!obsidianConfig.enabled) return { context: '' };

    const memory = new MemoryManager(obsidianConfig);
    const context = await memory.buildMemoryPrompt(data.topics);

    return { context };
  });

export const exportQuestionsToVault = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    examId: z.number(),
    examName: z.string(),
  }))
  .handler(async (ctx) => {
    const { data } = ctx;
    const db = await getDB(ctx);
    if (!db) throw new Error('D1 database not available');

    const queries = new DBQueries(db);
    const config = await queries.getAllConfig();
    const obsidianConfig = getObsidianConfig(config);

    if (!obsidianConfig.enabled) {
      return { exported: false, message: 'Obsidian integration is disabled' };
    }

    const questions = await queries.getQuestionsByExam(data.examId);
    if (questions.length === 0) {
      return { exported: false, message: 'No questions to export' };
    }

    const memory = new MemoryManager(obsidianConfig);
    const topic = questions[0]?.topic || 'General';
    const path = await memory.exportQuestionsToVault(
      data.examName,
      topic,
      questions.map(q => ({
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
      }))
    );

    return { exported: true, path, count: questions.length };
  });

export const saveStatsToVault = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const db = await getDB(ctx);
  if (!db) throw new Error('D1 database not available');

  const queries = new DBQueries(db);
  const config = await queries.getAllConfig();
  const obsidianConfig = getObsidianConfig(config);

  if (!obsidianConfig.enabled) {
    return { saved: false, message: 'Obsidian integration is disabled' };
  }

  const stats = await queries.getStats();
  const memory = new MemoryManager(obsidianConfig);
  const path = await memory.saveStatsToVault(stats);

  return { saved: true, path };
});

export const searchVault = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ query: z.string().min(1) }))
  .handler(async (ctx) => {
    const { data } = ctx;
    const db = await getDB(ctx);
    if (!db) return { results: [] };

    const queries = new DBQueries(db);
    const config = await queries.getAllConfig();
    const obsidianConfig = getObsidianConfig(config);

    if (!obsidianConfig.enabled) return { results: [] };

    const client = new ObsidianClient(obsidianConfig);
    const results = await client.search(data.query);

    return { results };
  });

export const setObsidianConfig = createServerFn({ method: 'POST' })
  .inputValidator(obsidianConfigSchema)
  .handler(async (ctx) => {
    const { data } = ctx;
    const db = await getDB(ctx);
    if (!db) throw new Error('D1 database not available');

    const queries = new DBQueries(db);
    await queries.setConfig('obsidian_host', data.host);
    await queries.setConfig('obsidian_port', String(data.port));
    if (data.apiKey) {
      await queries.setConfig('obsidian_api_key', data.apiKey);
    }
    await queries.setConfig('obsidian_enabled', String(data.enabled));

    return { success: true };
  });
