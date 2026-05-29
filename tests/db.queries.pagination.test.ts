import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  gets: [] as unknown[],
  alls: [] as unknown[],
  calls: [] as Array<{ method: string; args: unknown[] }>,
};

class FakeSelectBuilder {
  where(...args: unknown[]) {
    state.calls.push({ method: "where", args });
    return this;
  }
  orderBy(...args: unknown[]) {
    state.calls.push({ method: "orderBy", args });
    return this;
  }
  limit(...args: unknown[]) {
    state.calls.push({ method: "limit", args });
    return this;
  }
  offset(...args: unknown[]) {
    state.calls.push({ method: "offset", args });
    return this;
  }
  innerJoin(...args: unknown[]) {
    state.calls.push({ method: "innerJoin", args });
    return this;
  }
  async get() {
    if (state.gets.length === 0) throw new Error("Missing queued get() response");
    return state.gets.shift();
  }
  async all() {
    if (state.alls.length === 0) throw new Error("Missing queued all() response");
    return state.alls.shift();
  }
}

class FakeDrizzle {
  select(...args: unknown[]) {
    state.calls.push({ method: "select", args });
    return {
      from: (...fromArgs: unknown[]) => {
        state.calls.push({ method: "from", args: fromArgs });
        return new FakeSelectBuilder();
      },
    };
  }
}

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => new FakeDrizzle()),
}));

import { DBQueries } from "#/db/queries";

describe("DBQueries pagination contracts", () => {
  let queries: DBQueries;

  beforeEach(() => {
    state.gets = [];
    state.alls = [];
    state.calls = [];
    queries = new DBQueries({} as never);
  });

  it("normalizes page/pageSize bounds for exams pagination", async () => {
    state.gets.push({ count: 75 });
    state.alls.push([
      { id: 3, name: "Newest", source: "pdf", created_at: "2026-05-03" },
      { id: 2, name: "Middle", source: "pdf", created_at: "2026-05-02" },
    ]);

    const result = await queries.listExamsPaged({ page: -10, pageSize: 500 });

    expect(result.items).toHaveLength(2);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 50,
      totalItems: 75,
      totalPages: 2,
      hasNextPage: true,
      hasPrevPage: false,
    });

    const limitCall = state.calls.find((c) => c.method === "limit");
    const offsetCall = state.calls.find((c) => c.method === "offset");
    expect(limitCall?.args).toEqual([50]);
    expect(offsetCall?.args).toEqual([0]);
  });

  it("supports numeric-like input types for pagination and computes hasPrevPage", async () => {
    state.gets.push({ count: 10 });
    state.alls.push([
      {
        id: 10,
        exam_id: 1,
        question: "Q10",
        options: JSON.stringify(["A", "B"]),
        explanation: "exp",
        deep_explanation: "deep",
        topic: "Math",
        created_at: "2026-05-10",
      },
    ]);

    const result = await queries.listQuestionsPaged({
      page: "2" as never,
      pageSize: "3" as never,
    });

    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 3,
      totalItems: 10,
      totalPages: 4,
      hasNextPage: true,
      hasPrevPage: true,
    });

    const limitCall = state.calls.find((c) => c.method === "limit");
    const offsetCall = state.calls.find((c) => c.method === "offset");
    expect(limitCall?.args).toEqual([3]);
    expect(offsetCall?.args).toEqual([3]);
  });

  it("omits answer when includeAnswer=false", async () => {
    state.gets.push({ count: 1 });
    state.alls.push([
      {
        id: 1,
        exam_id: 7,
        question: "What is 2+2?",
        options: JSON.stringify(["3", "4"]),
        explanation: "base",
        deep_explanation: "deep",
        topic: "Math",
        created_at: "2026-05-01",
      },
    ]);

    const result = await queries.listQuestionsPaged({ includeAnswer: false });
    expect(result.items[0]).not.toHaveProperty("answer");
  });

  it("includes answer when includeAnswer=true", async () => {
    state.gets.push({ count: 1 });
    state.alls.push([
      {
        id: 1,
        exam_id: 7,
        question: "What is 2+2?",
        options: JSON.stringify(["3", "4"]),
        answer: "4",
        explanation: "base",
        deep_explanation: "deep",
        topic: "Math",
        created_at: "2026-05-01",
      },
    ]);

    const result = await queries.listQuestionsPaged({ includeAnswer: true });
    expect(result.items[0]).toHaveProperty("answer", "4");
  });

  it("returns pagination object shape for answer keys and attempts", async () => {
    state.gets.push({ count: 2 });
    state.alls.push([
      { id: 22, exam_id: 1, topic: "A", question: "new", answer: "x", created_at: "2026-05-02" },
      { id: 11, exam_id: 1, topic: "A", question: "old", answer: "y", created_at: "2026-05-01" },
    ]);
    state.gets.push({ count: 1 });
    state.alls.push([
      {
        id: 8,
        question_id: 22,
        user_answer: "x",
        correct: 1,
        timestamp: "2026-05-02",
        exam_id: 1,
        question: "new",
        topic: "A",
      },
    ]);

    const keys = await queries.listAnswerKeysPaged({ page: 1, pageSize: 2 });
    const attempts = await queries.listAttemptsPaged({ page: 1, pageSize: 2 });

    expect(keys.pagination).toEqual({
      page: 1,
      pageSize: 2,
      totalItems: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
    expect(attempts.pagination).toEqual({
      page: 1,
      pageSize: 2,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
    expect(attempts.items[0].correct).toBe(true);
  });

  it("surfaces predictable error metadata when underlying query fails", async () => {
    vi.spyOn(FakeSelectBuilder.prototype, "get").mockImplementationOnce(async () => {
      throw new Error("db exploded");
    });

    await expect(queries.listExamsPaged()).rejects.toMatchObject({
      name: "Error",
      message: "db exploded",
    });
  });
});
