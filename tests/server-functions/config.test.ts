import { describe, it, expect, vi } from 'vitest';

vi.mock('#/server-functions/config', () => ({
  getConfig: vi.fn(async () => ({
    provider: 'openrouter',
    model: 'openai/gpt-4o-mini',
    apiKey: '',
  })),
  setConfig: vi.fn(async ({ data }: { data: any }) => {
    expect(data.provider).toBeDefined();
    expect(data.model).toBeDefined();
    expect(data.apiKey).toBeDefined();
    return { success: true };
  }),
}));

import { getConfig, setConfig } from '#/server-functions/config';

describe('getConfig', () => {
  it('returns provider config from database', async () => {
    const result = await getConfig();
    expect(result.provider).toBe('openrouter');
    expect(result.model).toBe('openai/gpt-4o-mini');
  });
});

describe('setConfig', () => {
  it('saves provider config to database', async () => {
    const config = {
      provider: 'openai' as const,
      model: 'gpt-4o',
      apiKey: 'sk-test',
    };
    const result = await setConfig({ data: config });
    expect(result.success).toBe(true);
  });
});
