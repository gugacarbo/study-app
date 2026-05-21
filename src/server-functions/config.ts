import { createServerFn } from '@tanstack/react-start';
import { DBQueries } from '../db/queries';
import { getDB } from './db';
import { providerConfigSchema, type ProviderConfig } from '../lib/validation';

export const getConfig = createServerFn({ method: 'GET' }).handler(async (ctx) => {
  const db = getDB(ctx);
  if (!db) {
    throw new Error('D1 database not available');
  }

  const queries = new DBQueries(db);
  const config = await queries.getAllConfig();

  return {
    provider: (config.ai_provider || 'openrouter') as ProviderConfig['provider'],
    model: config.ai_model || 'openai/gpt-4o-mini',
    baseUrl: config.ai_base_url || undefined,
    apiKey: config.ai_api_key || '',
  };
});

export const setConfig = createServerFn({ method: 'POST' })
  .inputValidator(providerConfigSchema)
  .handler(async (ctx) => {
    const { data } = ctx;
    const db = getDB(ctx);
    if (!db) {
      throw new Error('D1 database not available');
    }

    const queries = new DBQueries(db);
    await queries.setConfig('ai_provider', data.provider);
    await queries.setConfig('ai_model', data.model);
    if (data.baseUrl) {
      await queries.setConfig('ai_base_url', data.baseUrl);
    }
    await queries.setConfig('ai_api_key', data.apiKey);

    return { success: true };
  });
