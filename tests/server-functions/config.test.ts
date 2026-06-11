import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DBQueries } from '#/db/queries';
import { providerConfigSchema } from '#/lib/validation';

function createMockDB() {
  const configStore = new Map([
    ['ai_model', 'openai/gpt-4o-mini'],
    ['ai_base_url', 'https://openrouter.ai/api/v1'],
  ]);

  return {
    prepare: vi.fn((sql: string) => {
      const bound = {
        raw: vi.fn(async () => {
          if (sql.includes('"config"') && /\bselect\b/i.test(sql)) {
            if (sql.includes('where') || sql.includes('WHERE')) {
              // getConfig — use params captured by bind
              return [];
            }
            // getAllConfig
            return Array.from(configStore.entries());
          }
          return [];
        }),
        all: vi.fn(async () => ({ results: [], success: true })),
        run: vi.fn(async () => ({ success: true, meta: { last_row_id: 1 } })),
      };

      return {
        bind: vi.fn((...params: unknown[]) => ({
          raw: vi.fn(async () => {
            if (sql.includes('"config"') && /\bselect\b/i.test(sql) && params.length > 0) {
              const val = configStore.get(params[0] as string);
              return val ? [[params[0], val]] : [];
            }
            return bound.raw();
          }),
          all: bound.all,
          run: bound.run,
        })),
        raw: bound.raw,
        all: bound.all,
        run: bound.run,
      };
    }),
    configStore,
  };
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
      expect(config.ai_model).toBe('openai/gpt-4o-mini');
      expect(config.ai_base_url).toBe('https://openrouter.ai/api/v1');
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
      await queries.setConfig('ai_base_url', 'https://api.openai.com/v1');
      expect(mockDB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('into "config"')
      );
    });
  });
});

describe('providerConfigSchema', () => {
  it('validates correct config', () => {
    const config = {
      model: 'openai/gpt-4o-mini',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-test',
    };
    const result = providerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('rejects missing apiKey', () => {
    const config = {
      model: 'openai/gpt-4o-mini',
      baseUrl: 'https://openrouter.ai/api/v1',
    };
    const result = providerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('rejects missing baseUrl', () => {
    const config = {
      model: 'gpt-4o',
      apiKey: 'sk-test',
    };
    const result = providerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});
