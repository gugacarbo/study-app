import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DBQueries } from '#/db/queries';


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

  it('creates an attempt session', async () => {
    await queries.createAttemptSession({
      examId: 1,
      topic: 'Math',
      totalQuestions: 10,
    });
    const [firstCall] = mockDB.prepare.mock.calls as unknown as Array<[string]>;
    expect(firstCall?.[0] ?? '').toContain('INSERT INTO attempts');
  });

  it('upserts an answer row for an attempt session', async () => {
    await queries.upsertAttemptAnswer({
      attemptId: 3,
      questionId: 1,
      userAnswer: '4',
      correct: true,
    });

    const [firstCall] = mockDB.prepare.mock.calls as unknown as Array<[string]>;
    expect(firstCall?.[0] ?? '').toContain('INSERT INTO attempt_answers');
  });

  it('recomputes attempt counters after recording an answer', async () => {
    await queries.refreshAttemptProgress(3);

    const [firstCall] = mockDB.prepare.mock.calls as unknown as Array<[string]>;
    expect(firstCall?.[0] ?? '').toContain('UPDATE attempts');
  });

  it('marks stale in-progress attempts as abandoned for the same quiz scope', async () => {
    await queries.abandonInProgressAttempts({
      examId: 1,
      topic: 'Math',
    });

    const [firstCall] = mockDB.prepare.mock.calls as unknown as Array<[string]>;
    expect(firstCall?.[0] ?? '').toContain('SET status = ?');
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
