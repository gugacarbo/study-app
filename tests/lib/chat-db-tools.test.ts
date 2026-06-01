import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@tanstack/ai", () => ({
  toolDefinition: (definition: Record<string, unknown>) => ({
    ...definition,
    server: (handler: (input: unknown) => Promise<unknown>) => ({
      ...definition,
      execute: handler,
    }),
  }),
}));

import { createChatDbTools } from "#/features/ai/tools/db-tools";

function createQueriesMock() {
  return {
    listExamsPaged: vi.fn<() => Promise<any>>(async () => ({
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })),
    listQuestionsPaged: vi.fn<() => Promise<any>>(async () => ({
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })),
    listAnswerKeysPaged: vi.fn<() => Promise<any>>(async () => ({
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })),
    listAttemptsPaged: vi.fn<() => Promise<any>>(async () => ({
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })),
  };
}

type Tool = {
  name: string;
  inputSchema: { safeParse: (input: unknown) => { success: boolean } };
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

function getTool(tools: readonly unknown[], name: string): Tool {
  const tool = tools.find((candidate) => (candidate as Tool).name === name);
  if (!tool) throw new Error(`Tool ${name} not found`);
  return tool as Tool;
}

describe("chat-db-tools", () => {
  const queries = createQueriesMock();
  const tools = createChatDbTools(queries as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates pageSize bounds and coercion", () => {
    const listExams = getTool(tools, "list_exams");

    expect(listExams.inputSchema.safeParse({ pageSize: "10" }).success).toBe(true);
    expect(listExams.inputSchema.safeParse({ pageSize: 0 }).success).toBe(false);
    expect(listExams.inputSchema.safeParse({ pageSize: 51 }).success).toBe(false);
    expect(listExams.inputSchema.safeParse({ page: "2", pageSize: "20" }).success).toBe(true);
  });

  it("hides answer for list_questions when includeAnswer=false", async () => {
    queries.listQuestionsPaged.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          exam_id: 1,
          question: "Q",
          options: ["A", "B"],
          answer: "A",
          explanation: "e",
          deepExplanation: "d",
          topic: "T",
          created_at: "2026-05-29",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    const listQuestions = getTool(tools, "list_questions");
    const result = (await listQuestions.execute({ includeAnswer: false })) as {
      ok: boolean;
      data: { items: Array<Record<string, unknown>> };
    };

    expect(result.ok).toBe(true);
    expect(result.data.items[0]).not.toHaveProperty("answer");
  });

  it("exposes answer for list_questions when includeAnswer=true", async () => {
    queries.listQuestionsPaged.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          exam_id: 1,
          question: "Q",
          options: ["A", "B"],
          answer: "A",
          explanation: "e",
          deepExplanation: "d",
          topic: "T",
          created_at: "2026-05-29",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    const listQuestions = getTool(tools, "list_questions");
    const result = (await listQuestions.execute({ includeAnswer: true })) as {
      ok: boolean;
      data: { items: Array<Record<string, unknown>> };
    };

    expect(result.ok).toBe(true);
    expect(result.data.items[0]).toHaveProperty("answer", "A");
  });

  it("truncates questionExcerpt for list_answer_keys", async () => {
    const longQuestion = `${"word ".repeat(40)}tail`;
    queries.listAnswerKeysPaged.mockResolvedValueOnce({
      items: [
        {
          id: 10,
          exam_id: 3,
          topic: "Math",
          question: longQuestion,
          answer: "42",
          created_at: "2026-05-29",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    const listAnswerKeys = getTool(tools, "list_answer_keys");
    const result = (await listAnswerKeys.execute({})) as {
      ok: boolean;
      data: { items: Array<{ questionExcerpt: string }> };
    };

    expect(result.ok).toBe(true);
    const excerpt = result.data.items[0].questionExcerpt;
    expect(excerpt.length).toBe(120);
    expect(excerpt.endsWith("...")).toBe(true);
  });

  it("returns stable error payload when query fails", async () => {
    queries.listAttemptsPaged.mockRejectedValueOnce(new Error("boom"));

    const listAttempts = getTool(tools, "list_attempts");
    const result = (await listAttempts.execute({})) as {
      ok: boolean;
      error?: { code: string; message: string };
    };

    expect(result).toEqual({
      ok: false,
      error: {
        code: "TOOL_EXECUTION_FAILED",
        message: "Unable to fetch data right now. Please try again.",
      },
    });
  });
});
