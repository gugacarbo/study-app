import { describe, it, expect } from 'vitest';
import { questionSchema, attemptSchema, providerConfigSchema, examIngestResponseSchema } from '#/lib/validation';

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

  it('applies default values for missing optional fields', () => {
    const minimal = {
      question: 'Test?',
      options: ['a', 'b'],
      answer: 'a',
    };
    const result = questionSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.explanation).toBe('');
      expect(result.data.topic).toBe('General');
    }
  });

  it('rejects single option array', () => {
    const invalid = {
      question: 'Test?',
      options: ['only one'],
      answer: 'only one',
    };
    const result = questionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('attemptSchema', () => {
  it('validates a correct attempt object', () => {
    const valid = {
      questionId: 1,
      userAnswer: '4',
      correct: true,
    };
    const result = attemptSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects missing questionId', () => {
    const invalid = {
      userAnswer: '4',
      correct: true,
    };
    const result = attemptSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects non-boolean correct field', () => {
    const invalid = {
      questionId: 1,
      userAnswer: '4',
      correct: 'yes',
    };
    const result = attemptSchema.safeParse(invalid);
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

  it('rejects invalid baseUrl', () => {
    const config = {
      provider: 'custom',
      model: 'llama3',
      baseUrl: 'not-a-url',
      apiKey: 'test',
    };
    const result = providerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});

describe('examIngestResponseSchema', () => {
  it('validates a correct ingest response', () => {
    const valid = {
      questions: [
        {
          question: 'What is 2+2?',
          options: ['3', '4', '5', '6'],
          answer: '4',
          explanation: 'Math',
          topic: 'Math',
        },
      ],
      topics: ['Math'],
    };
    const result = examIngestResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid nested question', () => {
    const invalid = {
      questions: [
        {
          question: '',
          options: [],
          answer: '',
        },
      ],
      topics: [],
    };
    const result = examIngestResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects missing topics array', () => {
    const invalid = {
      questions: [],
    };
    const result = examIngestResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
