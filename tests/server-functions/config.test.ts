import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DBQueries } from '#/db/queries';
import { providerConfigSchema } from '#/lib/validation';

// Mock D1 database with proper chaining
function createMockDB() {
  const configStore = new Map<string, string>();
  configStore.set('ai_provider', 'openrouter');
  configStore.set('ai_model', 'openai/gpt-4o-mini');

  const db = {
    prepare: vi.fn((sql: string) => {
      const stmt = {
        run: vi.fn(async () => ({ success: true, meta: { last_row_id: 1 } })),
        first: vi.fn(async () => null),
        all: vi.fn(async () => {
          if (sql.includes('SELECT key, value FROM config')) {
            return {
              results: Array.from(configStore.entries()).map(([key, value]) => ({ key, value })),
            };
          }
          return { results: [] };
        }),
        bind: vi.fn(() => ({
          run: vi.fn(async () => ({ success: true, meta: { last_row_id: 1 } })),
          first: vi.fn(async () => null),
          all: vi.fn(async () => ({ results: [] })),
        })),
      };
      return stmt;
    }),
    configStore,
  };

  return db;
}

describe('DBQueries config operations', () => {
  let mockDB: ReturnType<typeof createMockDB>;
  let queries: DBQueries;

  beforeEach(() => {
    mockDB = createMockDB();
    queries = new DBQueries(mockDB as any);
  });

  describe('getAllConfig', () => {
    it('returns all config key-value pairs', async () => {
      const config = await queries.getAllConfig();
      expect(config.ai_provider).toBe('openrouter');
      expect(config.ai_model).toBe('openai/gpt-4o-mini');
    });
  });

  describe('getConfig', () => {
    it('returns null for missing key', async () => {
      const value = await queries.getConfig('nonexistent');
      expect(value).toBeNull();
    });
  });

  describe('setConfig', () => {
    it('calls prepare with correct SQL', async () => {
      await queries.setConfig('ai_provider', 'openai');
      expect(mockDB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO config')
      );
    });
  });
});

describe('providerConfigSchema', () => {
  it('validates correct config', () => {
    const config = {
      provider: 'openrouter' as const,
      model: 'openai/gpt-4o-mini',
      apiKey: 'sk-test',
    };
    const result = providerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('rejects missing apiKey', () => {
    const config = {
      provider: 'openrouter' as const,
      model: 'openai/gpt-4o-mini',
    };
    const result = providerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('rejects invalid provider', () => {
    const config = {
      provider: 'invalid',
      model: 'gpt-4o',
      apiKey: 'sk-test',
    };
    const result = providerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});
