import { createServerFn } from '@tanstack/react-start';
import type { D1Database } from '@cloudflare/workers-types';
import { DBQueries } from '../db/queries';
import { providerConfigSchema, type ProviderConfig } from '../lib/validation';

function getDB(): D1Database {
  return (globalThis as any).env?.DB;
}

export const getConfig = createServerFn({ method: 'GET' }).handler(async () => {
  const db = getDB();
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

export const setConfig = createServerFn({ method: 'POST' }).handler(async ({ data }: { data: ProviderConfig }) => {
  const validated = providerConfigSchema.parse(data);

  const db = getDB();
  if (!db) {
    throw new Error('D1 database not available');
  }

  const queries = new DBQueries(db);
  await queries.setConfig('ai_provider', validated.provider);
  await queries.setConfig('ai_model', validated.model);
  if (validated.baseUrl) {
    await queries.setConfig('ai_base_url', validated.baseUrl);
  }
  await queries.setConfig('ai_api_key', validated.apiKey);

  return { success: true };
});
