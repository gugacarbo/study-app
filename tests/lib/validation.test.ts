import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  questionSchema,
  attemptSchema,
  createAiModelSchema,
  createAiProviderSchema,
  providerConfigSchema,
  testConnectionInputSchema,
  testModelBenchmarkInputSchema,
  toProviderConfig,
  resolveThinkingEffort,
  examIngestResponseSchema,
  normalizeExamIngestResponseWithDiagnostics,
} from '#/lib/validation';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('questionSchema', () => {
  it('validates a correct question object with answers array', () => {
    const valid = {
      question: 'What is 2+2?',
      options: ['3', '4', '5', '6'],
      answers: ['4'],
      explanation: 'Basic arithmetic',
      topic: 'Math',
    };
    const result = questionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts legacy answer field and maps to answers array', () => {
    const legacy = {
      question: 'What is 2+2?',
      options: ['3', '4', '5', '6'],
      answer: '4',
    };
    const result = questionSchema.safeParse(legacy);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.answers).toEqual(['4']);
      expect(result.data.scoringMode).toBe('exact');
    }
  });

  it('validates multiple correct answers', () => {
    const valid = {
      question: 'Select all primes',
      options: ['2', '3', '4', '6'],
      answers: ['2', '3'],
      scoringMode: 'partial',
    };
    const result = questionSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.answers).toEqual(['2', '3']);
      expect(result.data.scoringMode).toBe('partial');
    }
  });

  it('rejects missing question field', () => {
    const invalid = {
      options: ['a', 'b'],
      answers: ['a'],
    };
    const result = questionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects empty options array', () => {
    const invalid = {
      question: 'Test?',
      options: [],
      answers: ['a'],
    };
    const result = questionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('applies default values for missing optional fields', () => {
    const minimal = {
      question: 'Test?',
      options: ['a', 'b'],
      answers: ['a'],
    };
    const result = questionSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.explanation).toBe('');
      expect(result.data.deepExplanation).toBeUndefined();
      expect(result.data.topic).toBe('General');
      expect(result.data.scoringMode).toBe('exact');
    }
  });

  it('rejects single option array', () => {
    const invalid = {
      question: 'Test?',
      options: ['only one'],
      answers: ['only one'],
    };
    const result = questionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects empty answers array', () => {
    const invalid = {
      question: 'Test?',
      options: ['a', 'b'],
      answers: [],
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

  it('accepts optional credit and userAnswers', () => {
    const valid = {
      questionId: 1,
      userAnswer: '["A","B"]',
      userAnswers: ['A', 'B'],
      correct: true,
      credit: 0.5,
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

describe('resolveThinkingEffort', () => {
  it('returns default only when it is part of configured levels', () => {
    expect(resolveThinkingEffort(['low', 'high'], 'high')).toBe('high');
    expect(resolveThinkingEffort(['low', 'high'], 'medium')).toBeUndefined();
    expect(resolveThinkingEffort([], 'low')).toBeUndefined();
  });
});

describe('toProviderConfig', () => {
  it('maps resolved model config to adapter config', () => {
    expect(
      toProviderConfig({
        modelId: 1,
        providerName: 'OpenRouter',
        model: 'llama3',
        apiKey: 'ollama',
        baseUrl: 'http://localhost:11434/v1',
        thinkingEffortLevels: [],
      }),
    ).toEqual({
      model: 'llama3',
      apiKey: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      thinkingEffort: undefined,
    });
  });

  it('includes default thinking effort when configured', () => {
    expect(
      toProviderConfig({
        modelId: 1,
        providerName: 'OpenRouter',
        model: 'gpt-5',
        apiKey: 'sk-test',
        baseUrl: 'https://openrouter.ai/api/v1',
        thinkingEffortLevels: ['low', 'medium', 'high'],
        defaultThinkingEffort: 'medium',
      }),
    ).toEqual({
      model: 'gpt-5',
      apiKey: 'sk-test',
      baseUrl: 'https://openrouter.ai/api/v1',
      thinkingEffort: 'medium',
    });
  });
});

describe('createAiProviderSchema', () => {
  it('requires baseUrl and apiKey', () => {
    expect(
      createAiProviderSchema.safeParse({
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: 'sk-test',
      }).success,
    ).toBe(true);
  });
});

describe('createAiModelSchema', () => {
  it('validates model catalog fields', () => {
    expect(
      createAiModelSchema.safeParse({
        providerId: 1,
        modelId: 'openai/gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        contextWindow: 128000,
        inputCostPerMillion: 0.15,
        outputCostPerMillion: 0.6,
      }).success,
    ).toBe(true);
  });

  it('rejects default thinking effort outside selected levels', () => {
    const result = createAiModelSchema.safeParse({
      providerId: 1,
      modelId: 'openai/gpt-5',
      displayName: 'GPT-5',
      thinkingEffortLevels: ['low'],
      defaultThinkingEffort: 'high',
    });
    expect(result.success).toBe(false);
  });
});

describe('testConnectionInputSchema', () => {
  it('requires modelId', () => {
    expect(testConnectionInputSchema.safeParse({ modelId: 1 }).success).toBe(
      true,
    );
    expect(testConnectionInputSchema.safeParse({}).success).toBe(false);
  });
});

describe('testModelBenchmarkInputSchema', () => {
  it('requires modelId', () => {
    expect(testModelBenchmarkInputSchema.safeParse({ modelId: 1 }).success).toBe(
      true,
    );
    expect(testModelBenchmarkInputSchema.safeParse({}).success).toBe(false);
  });
});

describe('providerConfigSchema', () => {
  it('validates OpenRouter config', () => {
    const config = {
      model: 'openai/gpt-4o-mini',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-or-v1-xxx',
    };
    const result = providerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('validates custom endpoint with baseUrl', () => {
    const config = {
      model: 'llama3',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'ollama',
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
      model: 'openai/gpt-4o-mini',
      apiKey: 'sk-or-v1-xxx',
    };
    const result = providerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('rejects invalid baseUrl', () => {
    const config = {
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
          answers: ['4'],
          explanation: 'Math',
          topic: 'Math',
        },
      ],
      topics: ['Math'],
    };
    const result = examIngestResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts legacy answer in ingest response', () => {
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
    if (result.success) {
      expect(result.data.questions[0].answers).toEqual(['4']);
    }
  });

  it('rejects invalid nested question', () => {
    const invalid = {
      questions: [
        {
          question: '',
          options: [],
          answers: [],
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

  it('salvages valid questions when one malformed open-ended question would otherwise fail the whole extraction', () => {
    const candidate = {
      questions: [
        {
          question: 'O que e o modelo OSI?',
          options: [],
          answer: 'Um modelo de referencia com sete camadas.',
          explanation: '',
          topic: 'Redes',
        },
        {
          question: 'Questao truncada no fim da resposta',
          options: ['Opcao isolada'],
          explanation: '',
          topic: 'Redes',
        },
      ],
      topics: ['Redes'],
    };

    const result = examIngestResponseSchema.safeParse(candidate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.questions).toHaveLength(1);
      expect(result.data.questions[0]).toMatchObject({
        question: 'O que e o modelo OSI?',
        options: [
          'Um modelo de referencia com sete camadas.',
          'Resposta incorreta.',
        ],
        answers: ['Um modelo de referencia com sete camadas.'],
        explanation: '',
        topic: 'Redes',
      });
      expect(result.data.topics).toEqual(['Redes']);
    }
  });

  it('reports discarded malformed questions with index and preview', () => {
    const result = normalizeExamIngestResponseWithDiagnostics({
      questions: [
        {
          question: 'Pergunta valida',
          options: [],
          answer: 'Resposta valida',
          explanation: '',
          topic: 'Redes',
        },
        {
          question: 'Questao truncada no fim da resposta',
          options: ['Opcao isolada'],
          explanation: '',
          topic: 'Redes',
        },
        null,
      ],
      topics: ['Redes'],
    });

    expect(result.discardedQuestions).toEqual([
      {
        index: 1,
        reason: 'missing-answer',
        questionPreview: 'Questao truncada no fim da resposta',
      },
      {
        index: 2,
        reason: 'non-object',
        questionPreview: undefined,
      },
    ]);
  });

  it('warns when ingest normalization discards malformed questions', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    examIngestResponseSchema.safeParse({
      questions: [
        {
          question: 'Pergunta valida',
          options: [],
          answer: 'Resposta valida',
          explanation: '',
          topic: 'Redes',
        },
        {
          question: 'Questao truncada no fim da resposta',
          options: ['Opcao isolada'],
          explanation: '',
          topic: 'Redes',
        },
      ],
      topics: ['Redes'],
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'Discarded malformed ingest questions during normalization:',
      JSON.stringify([
        {
          index: 1,
          reason: 'missing-answer',
          questionPreview: 'Questao truncada no fim da resposta',
        },
      ]),
    );
  });
});
