import type { ToolSet } from "ai";
import { describe, expect, it, vi } from "vitest";
import {
	analyzeChatDbSearchState,
	chatDbSearchEscalationPending,
	chatDbSearchExhausted,
	chatStepOnlyBlockedListToolResults,
	getChatDbSearchEscalationPlan,
	shouldDisableChatListToolAfterResult,
	wrapChatToolsWithCallGuards,
} from "@/features/ai/lib/chat-tool-call-guards";

function createListQuestionsTool() {
	return {
		execute: vi.fn(async (input: { page?: number }) => ({
			ok: true as const,
			data: {
				items: [],
				pagination: {
					page: input.page ?? 1,
					pageSize: 20,
					totalItems: 0,
					totalPages: 1,
					hasNextPage: false,
					hasPrevPage: false,
				},
			},
		})),
	};
}

describe("wrapChatToolsWithCallGuards", () => {
	it("blocks an identical list_questions call in the same turn", async () => {
		const listQuestions = createListQuestionsTool();
		const tools = wrapChatToolsWithCallGuards({
			list_questions: listQuestions,
		} as unknown as ToolSet);

		const execute = tools.list_questions?.execute;
		expect(execute).toBeTypeOf("function");

		const input = { examId: 7, page: 1, includeAnswer: false };
		const first = await execute?.(input, {} as never);
		const second = await execute?.(input, {} as never);

		expect(first).toMatchObject({ ok: true });
		expect(second).toMatchObject({
			ok: false,
			error: { code: "DUPLICATE_TOOL_CALL" },
		});
		expect(listQuestions.execute).toHaveBeenCalledTimes(1);
	});

	it("treats equivalent list_questions inputs as duplicates after normalization", async () => {
		const listQuestions = createListQuestionsTool();
		const tools = wrapChatToolsWithCallGuards({
			list_questions: listQuestions,
		} as unknown as ToolSet);

		const execute = tools.list_questions?.execute;
		expect(execute).toBeTypeOf("function");

		await execute?.({ examId: 7 }, {} as never);
		const second = await execute?.(
			{ examId: 7, page: 1, pageSize: 20, includeAnswer: false },
			{} as never,
		);

		expect(second).toMatchObject({
			ok: false,
			error: { code: "DUPLICATE_TOOL_CALL" },
		});
		expect(listQuestions.execute).toHaveBeenCalledTimes(1);
	});

	it("allows list_questions with different arguments", async () => {
		const listQuestions = createListQuestionsTool();
		const tools = wrapChatToolsWithCallGuards({
			list_questions: listQuestions,
		} as unknown as ToolSet);

		const execute = tools.list_questions?.execute;
		expect(execute).toBeTypeOf("function");

		await execute?.({ examId: 7, page: 1, includeAnswer: false }, {} as never);
		await execute?.({ examId: 8, page: 1, includeAnswer: false }, {} as never);

		expect(listQuestions.execute).toHaveBeenCalledTimes(2);
	});

	it("limits repeated successful list_questions calls to three per turn", async () => {
		const listQuestions = createListQuestionsTool();
		const tools = wrapChatToolsWithCallGuards({
			list_questions: listQuestions,
		} as unknown as ToolSet);

		const execute = tools.list_questions?.execute;
		expect(execute).toBeTypeOf("function");

		for (let page = 1; page <= 4; page += 1) {
			const result = await execute?.(
				{ examId: 7, page, includeAnswer: false },
				{} as never,
			);
			if (page <= 3) {
				expect(result).toMatchObject({ ok: true });
				continue;
			}
			expect(result).toMatchObject({
				ok: false,
				error: { code: "TOOL_CALL_LIMIT" },
			});
		}

		expect(listQuestions.execute).toHaveBeenCalledTimes(3);
	});
});

describe("shouldDisableChatListToolAfterResult", () => {
	it("disables after an empty successful list_questions result without more pages", () => {
		expect(
			shouldDisableChatListToolAfterResult("list_questions", {
				ok: true,
				data: {
					items: [],
					pagination: { hasNextPage: false },
				},
			}),
		).toBe(true);
	});

	it("keeps list_questions available when an empty page still has next page", () => {
		expect(
			shouldDisableChatListToolAfterResult("list_questions", {
				ok: true,
				data: {
					items: [],
					pagination: { hasNextPage: true },
				},
			}),
		).toBe(false);
	});

	it("disables after a successful list_answer_keys result with items", () => {
		expect(
			shouldDisableChatListToolAfterResult("list_answer_keys", {
				ok: true,
				data: {
					items: [{ id: 1 }],
					pagination: { hasNextPage: false },
				},
			}),
		).toBe(true);
	});

	it("keeps the tool available when more pages remain", () => {
		expect(
			shouldDisableChatListToolAfterResult("list_questions", {
				ok: true,
				data: {
					items: [{ id: 1 }],
					pagination: { hasNextPage: true },
				},
			}),
		).toBe(false);
	});

	it("disables after duplicate list_answer_keys when textContains was used", () => {
		expect(
			shouldDisableChatListToolAfterResult(
				"list_answer_keys",
				{
					ok: false,
					error: { code: "DUPLICATE_TOOL_CALL" },
				},
				{ textContains: "Sistemas Operacionais" },
			),
		).toBe(true);
	});

	it("keeps list_answer_keys available after duplicate topic-only search", () => {
		expect(
			shouldDisableChatListToolAfterResult(
				"list_answer_keys",
				{
					ok: false,
					error: { code: "DUPLICATE_TOOL_CALL" },
				},
				{ topic: "Sistemas Operacionais" },
			),
		).toBe(false);
	});

	it("disables after empty textContains answer key search", () => {
		expect(
			shouldDisableChatListToolAfterResult(
				"list_answer_keys",
				{
					ok: true,
					data: {
						items: [],
						pagination: { hasNextPage: false },
					},
				},
				{ textContains: "Sistemas Operacionais" },
			),
		).toBe(true);
	});
});

function createSearchStep(
	toolResults: Array<{
		toolName: string;
		input?: unknown;
		output: unknown;
	}>,
) {
	return {
		toolResults: toolResults.map((result, index) => ({
			type: "tool-result" as const,
			toolCallId: `tc-${index}`,
			toolName: result.toolName,
			input: result.input ?? {},
			output: result.output,
		})),
	};
}

describe("chat db search escalation", () => {
	it("tracks topic then textContains phases", () => {
		const steps = [
			createSearchStep([
				{
					toolName: "list_questions",
					input: { topic: "Sistemas Operacionais" },
					output: {
						ok: true,
						data: { items: [], pagination: { hasNextPage: false } },
					},
				},
				{
					toolName: "list_answer_keys",
					input: { textContains: "Sistemas Operacionais" },
					output: {
						ok: true,
						data: {
							items: [{ id: 1 }],
							pagination: { hasNextPage: false },
						},
					},
				},
			]),
		];

		expect(analyzeChatDbSearchState(steps)).toMatchObject({
			topicQuestionsAttempted: true,
			topicQuestionsEmpty: true,
			textAnswerKeysAttempted: true,
			textAnswerKeysEmpty: false,
		});
	});

	it("escalates to list_answer_keys after empty topic question search", () => {
		const steps = [
			createSearchStep([
				{
					toolName: "list_questions",
					input: { topic: "Sistemas Operacionais" },
					output: {
						ok: true,
						data: { items: [], pagination: { hasNextPage: false } },
					},
				},
			]),
		];

		expect(
			getChatDbSearchEscalationPlan(
				steps,
				["list_questions", "list_answer_keys", "list_exams"],
				new Set(),
			),
		).toEqual({
			kind: "tools",
			activeTools: ["list_answer_keys"],
			toolChoice: { type: "tool", toolName: "list_answer_keys" },
		});
	});

	it("marks search exhausted after topic and textContains return empty", () => {
		const steps = [
			createSearchStep([
				{
					toolName: "list_questions",
					input: { topic: "Sistemas Operacionais" },
					output: {
						ok: true,
						data: { items: [], pagination: { hasNextPage: false } },
					},
				},
				{
					toolName: "list_answer_keys",
					input: { textContains: "Sistemas Operacionais" },
					output: {
						ok: true,
						data: { items: [], pagination: { hasNextPage: false } },
					},
				},
				{
					toolName: "list_exams",
					input: { nameContains: "Sistemas Operacionais" },
					output: {
						ok: true,
						data: { items: [], pagination: { hasNextPage: false } },
					},
				},
			]),
		];

		expect(chatDbSearchExhausted(steps)).toBe(true);
		expect(
			getChatDbSearchEscalationPlan(
				steps,
				["list_questions", "list_answer_keys", "list_exams"],
				new Set(["list_questions", "list_answer_keys", "list_exams"]),
			),
		).toEqual({ kind: "force_text" });
	});

	it("detects blocked duplicate-only steps", () => {
		expect(
			chatStepOnlyBlockedListToolResults([
				{
					toolName: "list_questions",
					output: {
						ok: false,
						error: { code: "DUPLICATE_TOOL_CALL" },
					},
				},
			]),
		).toBe(true);
	});

	it("reports escalation pending after empty topic search before textContains", () => {
		const steps = [
			{
				toolResults: [
					{
						toolName: "list_questions",
						output: {
							ok: true,
							data: { items: [], pagination: { hasNextPage: false } },
						},
					},
				],
			},
		];

		expect(chatDbSearchEscalationPending(steps)).toBe(true);
	});

	it("reads list tool input from matching toolCalls when toolResults omit input", () => {
		const steps = [
			{
				toolCalls: [
					{
						toolCallId: "tc-1",
						toolName: "list_questions",
						input: { topic: "Sistemas Operacionais" },
					},
				],
				toolResults: [
					{
						toolCallId: "tc-1",
						toolName: "list_questions",
						output: {
							ok: true,
							data: { items: [], pagination: { hasNextPage: false } },
						},
					},
				],
			},
		];

		const state = analyzeChatDbSearchState(steps);
		expect(state.topicQuestionsAttempted).toBe(true);
		expect(state.topicQuestionsEmpty).toBe(true);
	});
});
