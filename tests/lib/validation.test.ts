import { describe, it, expect } from 'vitest';
import { questionSchema, attemptSchema, providerConfigSchema } from '#/lib/validation';

describe('questionSchema', () => {
  it('validates a correct question object', () => {
    const valid = {
      question: 'What is 2+2?',
      options: ['3', '4', '5', '6'],
      answer: '4',
      explanation: 'Basic arithmetic',
      topic: 'Math',
    };
    const result = questionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects missing question field', () => {
    const invalid = {
      options: ['a', 'b'],
      answer: 'a',
    };
    const result = questionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects empty options array', () => {
    const invalid = {
      question: 'Test?',
      options: [],
      answer: 'a',
    };
    const result = questionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('providerConfigSchema', () => {
  it('validates OpenRouter config', () => {
    const config = {
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      apiKey: 'sk-or-v1-xxx',
    };
    const result = providerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('validates custom provider with baseUrl', () => {
    const config = {
      provider: 'custom',
      model: 'llama3',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'ollama',
    };
    const result = providerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('rejects missing apiKey', () => {
    const config = {
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
    };
    const result = providerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});
