import type { ToolSet } from "ai";
import { describe, expect, it, vi } from "vitest";
import { wrapChatToolsWithCallGuards } from "@/features/ai/lib/chat-tool-call-guards";

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
