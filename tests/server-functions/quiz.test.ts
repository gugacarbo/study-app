import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DBQueries } from '#/db/queries';

vi.mock('#/lib/ai', () => ({
  getExplanation: vi.fn(async () => 'This is the correct answer because...'),
  generateQuizQuestions: vi.fn(async () => []),
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
      expect.stringContaining('INSERT INTO attempts')
    );
  });

  it('gets questions by exam', async () => {
    await queries.getQuestionsByExam(1);
    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('WHERE exam_id = ?')
    );
  });

  it('gets random questions', async () => {
    await queries.getRandomQuestions(10);
    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY RANDOM()')
    );
  });
});
