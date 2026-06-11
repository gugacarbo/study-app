import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ToolSet } from "ai";
import { createChatDbTools } from "#/features/ai/tools/db-tools";
import { listAttemptsInputSchema } from "#/features/ai/tools/db-tools/attempt-tools";
import { listExamsInputSchema } from "#/features/ai/tools/db-tools/exam-tools";
import { listQuestionsInputSchema } from "#/features/ai/tools/db-tools/question-list-tools";

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

type ExecutableTool = {
	execute: (input: Record<string, unknown>) => Promise<unknown>;
};

function getTool(tools: ToolSet, name: string): ExecutableTool {
	const tool = tools[name];
	if (!tool?.execute) throw new Error(`Tool ${name} not found`);
	return tool as unknown as ExecutableTool;
}

describe("chat-db-tools", () => {
	const queries = createQueriesMock();
	const tools = createChatDbTools(queries as never);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("validates pageSize bounds and coercion", () => {
		expect(listExamsInputSchema.safeParse({ pageSize: "10" }).success).toBe(
			true,
		);
		expect(listExamsInputSchema.safeParse({ pageSize: 0 }).success).toBe(false);
		expect(listExamsInputSchema.safeParse({ pageSize: 51 }).success).toBe(
			false,
		);
		expect(
			listExamsInputSchema.safeParse({ page: "2", pageSize: "20" }).success,
		).toBe(true);
	});

	it("hides answers for list_questions when includeAnswer=false", async () => {
		queries.listQuestionsPaged.mockResolvedValueOnce({
			items: [
				{
					id: 1,
					exam_id: 1,
					question: "Q",
					options: ["A", "B"],
					answers: ["A"],
					scoringMode: "exact",
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
		expect(result.data.items[0]).not.toHaveProperty("answers");
	});

	it("exposes answers for list_questions when includeAnswer=true", async () => {
		queries.listQuestionsPaged.mockResolvedValueOnce({
			items: [
				{
					id: 1,
					exam_id: 1,
					question: "Q",
					options: ["A", "B"],
					answers: ["A"],
					scoringMode: "exact",
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
		expect(result.data.items[0]).toMatchObject({
			answers: ["A"],
			scoringMode: "exact",
		});
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

	it("returns session-level attempt rows for list_attempts", async () => {
		queries.listAttemptsPaged.mockResolvedValueOnce({
			items: [
				{
					id: 4,
					exam_id: 2,
					topic: "Math",
					total_questions: 10,
					answered_questions: 7,
					correct_answers: 5,
					status: "in_progress",
					started_at: "2026-06-03T10:00:00Z",
					completed_at: null,
					updated_at: "2026-06-03T10:05:00Z",
					accuracy: 71,
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

		const listAttempts = getTool(tools, "list_attempts");
		const result = (await listAttempts.execute({})) as {
			ok: boolean;
			data: { items: Array<Record<string, unknown>> };
		};

		expect(result.ok).toBe(true);
		expect(result.data.items[0]).toEqual({
			id: 4,
			exam_id: 2,
			topic: "Math",
			total_questions: 10,
			answered_questions: 7,
			correct_answers: 5,
			status: "in_progress",
			started_at: "2026-06-03T10:00:00Z",
			completed_at: null,
			updated_at: "2026-06-03T10:05:00Z",
			accuracy: 71,
		});
	});

	it("accepts list_attempts filter schema", () => {
		expect(listAttemptsInputSchema.safeParse({ pageSize: "10" }).success).toBe(
			true,
		);
		expect(listQuestionsInputSchema.safeParse({ includeAnswer: false }).success)
			.toBe(true);
	});
});
