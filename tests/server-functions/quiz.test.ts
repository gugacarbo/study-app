import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DBQueries } from '#/db/queries';

vi.mock('#/lib/prompts/explain-answer', () => ({
  getExplanation: vi.fn(async () => 'This is the correct answer because...'),
}));
vi.mock('#/lib/prompts/generate-quiz', () => ({
  generateQuizQuestions: vi.fn(async () => []),
}));

function createMockDB() {
  return {
    prepare: vi.fn(() => {
      const bound = {
        raw: vi.fn(async () => []),
        all: vi.fn(async () => ({ results: [], success: true })),
        run: vi.fn(async () => ({ success: true, meta: { last_row_id: 1 } })),
      };

      return {
        bind: vi.fn(() => ({
          raw: vi.fn(async () => []),
          all: vi.fn(async () => ({ results: [], success: true })),
          run: vi.fn(async () => ({ success: true, meta: { last_row_id: 1 } })),
        })),
        raw: bound.raw,
        all: bound.all,
        run: bound.run,
      };
    }),
  };
}

describe('DBQueries quiz operations', () => {
  let mockDB: ReturnType<typeof createMockDB>;
  let queries: DBQueries;

  beforeEach(() => {
    mockDB = createMockDB();
    queries = new DBQueries(mockDB as any);
  });

  it('records an attempt', async () => {
    await queries.recordAttempt(1, '4', true);
    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('insert into "attempts"')
    );
  });

  it('gets questions by exam', async () => {
    await queries.getQuestionsByExam(1);
    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('"exam_id" = ?')
    );
  });

  it('gets random questions', async () => {
    await queries.getRandomQuestions(10);
    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('RANDOM()')
    );
  });
});
