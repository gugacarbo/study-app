import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DBQueries } from '#/db/queries';
import type { ProviderConfig } from '#/lib/validation';

// Mock AI module
vi.mock('#/lib/ai', () => ({
  extractQuestionsFromText: vi.fn(async () => ({
    questions: [
      {
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        answer: '4',
        explanation: 'Basic math',
        topic: 'Math',
      },
    ],
    topics: ['Math'],
  })),
}));

function createMockDB() {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        run: vi.fn(async () => ({ success: true, meta: { last_row_id: 1 } })),
        first: vi.fn(async () => null),
        all: vi.fn(async () => ({ results: [] })),
      })),
      run: vi.fn(async () => ({ success: true, meta: { last_row_id: 1 } })),
      first: vi.fn(async () => null),
      all: vi.fn(async () => ({ results: [] })),
    })),
    batch: vi.fn(async () => []),
  };
}

describe('ingestExam server function', () => {
  let mockDB: ReturnType<typeof createMockDB>;
  let queries: DBQueries;

  beforeEach(() => {
    mockDB = createMockDB();
    queries = new DBQueries(mockDB as any);
  });

  it('inserts exam and questions', async () => {
    const examId = await queries.insertExam('test.pdf', 'upload');
    expect(examId).toBe(1);

    await queries.insertQuestions(examId, [
      {
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        answer: '4',
        explanation: 'Basic math',
        topic: 'Math',
      },
    ]);

    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO exams')
    );
    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO questions')
    );
  });
});

describe('extractTextFromFile', () => {
  it('extracts text from file bytes', async () => {
    const content = 'This is a test exam question with enough text to pass the minimum length requirement for parsing';
    const file = new File([content], 'test.txt', { type: 'text/plain' });
    const text = await file.text();
    expect(text.length).toBeGreaterThan(50);
  });
});
