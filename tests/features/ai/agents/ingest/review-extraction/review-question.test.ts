import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/ai", () => ({
	toolDefinition: (definition: Record<string, unknown>) => ({
		...definition,
		server: (handler: (input: unknown) => Promise<unknown>) => ({
			...definition,
			execute: handler,
		}),
	}),
}));

const { streamChatMessagesMock } = vi.hoisted(() => ({
	streamChatMessagesMock: vi.fn(),
}));

vi.mock("@/features/ai/core/chat-stream", () => ({
	streamChatMessages: streamChatMessagesMock,
}));

import { reviewSingleQuestion } from "@/features/ai/agents/ingest/review-extraction/review-question";

type Tool = {
	name: string;
	execute: (input: Record<string, unknown>) => Promise<unknown>;
};

function getTool(tools: readonly unknown[] | undefined, name: string): Tool {
	const tool = tools?.find((candidate) => (candidate as Tool).name === name);
	if (!tool) throw new Error(`Tool ${name} not found`);
	return tool as Tool;
}

describe("reviewSingleQuestion", () => {
	beforeEach(() => {
		streamChatMessagesMock.mockReset();
	});

	it("reviews a question through workspace tools and forwards tool events", async () => {
		streamChatMessagesMock.mockImplementation(
			(
				_config: unknown,
				_messages: unknown,
				options?: { tools?: readonly unknown[] },
			) =>
				(async function* () {
					yield {
						type: "TEXT_MESSAGE_CONTENT",
						delta: "Conferindo a questao extraida...",
					};

					const listQuestions = getTool(
						options?.tools,
						"list_extracted_questions",
					);
					const updateQuestion = getTool(
						options?.tools,
						"update_extracted_question",
					);

					await listQuestions.execute({});
					yield {
						type: "TOOL_CALL_END",
						toolCallId: "tool-1",
						toolCallName: "list_extracted_questions",
						input: {},
						result: {
							ok: true,
							totalQuestions: 1,
							data: [
								{
									questionId: "q1",
									question: "O que e cache?",
									options: ["A", "B"],
									answer: "A",
									topic: "Arquitetura",
								},
							],
						},
					};

					await updateQuestion.execute({
						questionId: "q1",
						answer: "Memoria rapida",
						options: ["Memoria rapida", "Disco"],
					});
					yield {
						type: "TOOL_CALL_END",
						toolCallId: "tool-2",
						toolCallName: "update_extracted_question",
						input: {
							questionId: "q1",
							answer: "Memoria rapida",
							options: ["Memoria rapida", "Disco"],
						},
						result: {
							ok: true,
							questionId: "q1",
							updatedFields: ["answer", "options"],
						},
					};

					yield {
						type: "RUN_FINISHED",
						threadId: "thread-1",
						runId: "run-1",
						finishReason: "stop",
						usage: {
							promptTokens: 12,
							completionTokens: 8,
							totalTokens: 20,
						},
					};
				})(),
		);

		const onAgentEvent = vi.fn();
		const webTools = [{ name: "web_search", execute: vi.fn() }] as unknown[];

		const result = await reviewSingleQuestion(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
			},
			"Texto original da prova",
			{
				question: "O que e cache?",
				options: ["A", "B"],
				answer: "A",
				explanation: "",
				topic: "Arquitetura",
			},
			0,
			1,
			{
				reviewTopics: ["Arquitetura"],
				tools: webTools as never,
				onAgentEvent,
				createAgentRunId: () => "review-q1",
			},
		);

		expect(result).toEqual({
			question: {
				question: "O que e cache?",
				options: ["Memoria rapida", "Disco"],
				answer: "Memoria rapida",
				explanation: "",
				topic: "Arquitetura",
			},
			success: true,
		});
		expect(streamChatMessagesMock).toHaveBeenCalledWith(
			expect.anything(),
			[{ role: "user", content: expect.stringContaining("Review extracted question #1.") }],
			expect.objectContaining({
				tools: expect.arrayContaining([
					expect.objectContaining({ name: "list_extracted_questions" }),
					expect.objectContaining({ name: "update_extracted_question" }),
					expect.objectContaining({ name: "web_search" }),
				]),
				system: expect.stringContaining(
					"You are a reviewer for a single extracted exam question.",
				),
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				eventType: "lifecycle",
				status: "pending",
				agentRunId: "review-q1",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				eventType: "lifecycle",
				status: "running",
				agentRunId: "review-q1",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({
				eventType: "tool-call",
				agentRunId: "review-q1",
				name: "list_extracted_questions",
				arguments: "{}",
				input: {},
				state: "input-complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			4,
			expect.objectContaining({
				eventType: "tool-result",
				agentRunId: "review-q1",
				content: {
					ok: true,
					totalQuestions: 1,
					data: [
						{
							questionId: "q1",
							question: "O que e cache?",
							options: ["A", "B"],
							answer: "A",
							topic: "Arquitetura",
						},
					],
				},
				state: "complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			5,
			expect.objectContaining({
				eventType: "tool-call",
				agentRunId: "review-q1",
				name: "update_extracted_question",
				arguments: JSON.stringify({
					questionId: "q1",
					answer: "Memoria rapida",
					options: ["Memoria rapida", "Disco"],
				}),
				state: "input-complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			6,
			expect.objectContaining({
				eventType: "tool-result",
				agentRunId: "review-q1",
				content: {
					ok: true,
					questionId: "q1",
					updatedFields: ["answer", "options"],
				},
				state: "complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			7,
			expect.objectContaining({
				eventType: "token",
				agentRunId: "review-q1",
				tokens: {
					promptTokens: 12,
					completionTokens: 8,
					totalTokens: 20,
				},
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			8,
			expect.objectContaining({
				eventType: "result",
				agentRunId: "review-q1",
				rawText: expect.stringContaining("[tool:update_extracted_question]"),
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			9,
			expect.objectContaining({
				eventType: "lifecycle",
				status: "done",
				agentRunId: "review-q1",
			}),
		);
	});

	it("deduplicates repeated tool transcript lines for the same reviewer toolCallId", async () => {
		streamChatMessagesMock.mockImplementation(
			(
				_config: unknown,
				_messages: unknown,
				options?: { tools?: readonly unknown[] },
			) =>
				(async function* () {
					const updateQuestion = getTool(
						options?.tools,
						"update_extracted_question",
					);

					await updateQuestion.execute({
						questionId: "q1",
						answer: "Memoria rapida",
					});
					yield {
						type: "TOOL_CALL_END",
						toolCallId: "tool-review-dedupe-1",
						toolCallName: "update_extracted_question",
						input: {
							questionId: "q1",
							answer: "Memoria rapida",
						},
						result: {
							ok: false,
							error: { message: "retry" },
						},
					};
					yield {
						type: "TOOL_CALL_END",
						toolCallId: "tool-review-dedupe-1",
						toolCallName: "update_extracted_question",
						input: {
							questionId: "q1",
							answer: "Memoria rapida",
						},
						result: {
							ok: true,
							questionId: "q1",
							updatedFields: ["answer"],
						},
					};
					yield {
						type: "RUN_FINISHED",
						threadId: "thread-1",
						runId: "run-1",
						finishReason: "stop",
					};
				})(),
		);

		const onAgentEvent = vi.fn();

		await reviewSingleQuestion(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
			},
			"Texto original da prova",
			{
				question: "O que e cache?",
				options: ["A", "B"],
				answer: "A",
				explanation: "",
				topic: "Arquitetura",
			},
			0,
			1,
			{
				reviewTopics: ["Arquitetura"],
				onAgentEvent,
				createAgentRunId: () => "review-q1",
			},
		);

		const resultEvent = onAgentEvent.mock.calls.find(
			([event]) => event?.eventType === "result",
		)?.[0];
		const toolMatches =
			String(resultEvent?.rawText).match(/\[tool:update_extracted_question\]/g) ?? [];

		expect(toolMatches).toHaveLength(1);
	});

	it("succeeds when reviewer sends an all-null update for an already correct question", async () => {
		streamChatMessagesMock.mockImplementation(
			(
				_config: unknown,
				_messages: unknown,
				options?: { tools?: readonly unknown[] },
			) =>
				(async function* () {
					const listQuestions = getTool(
						options?.tools,
						"list_extracted_questions",
					);
					const updateQuestion = getTool(
						options?.tools,
						"update_extracted_question",
					);

					await listQuestions.execute({});
					yield {
						type: "TOOL_CALL_END",
						toolCallId: "tool-review-noop-1",
						toolCallName: "list_extracted_questions",
						input: {},
						result: {
							ok: true,
							data: [
								{
									questionId: "q1",
									question: "O que e cache?",
									answer: "A",
									topic: "Arquitetura",
								},
							],
						},
					};

					await updateQuestion.execute({
						questionId: "q1",
						question: null,
						options: null,
						answer: null,
						topic: null,
						explanation: null,
					});
					yield {
						type: "TOOL_CALL_END",
						toolCallId: "tool-review-noop-2",
						toolCallName: "update_extracted_question",
						input: {
							questionId: "q1",
							question: null,
							options: null,
							answer: null,
							topic: null,
							explanation: null,
						},
						result: {
							ok: true,
							questionId: "q1",
							updatedFields: [],
						},
					};

					yield {
						type: "RUN_FINISHED",
						threadId: "thread-1",
						runId: "run-1",
						finishReason: "stop",
					};
				})(),
		);

		const onAgentEvent = vi.fn();

		const result = await reviewSingleQuestion(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
			},
			"Texto original da prova",
			{
				question: "O que e cache?",
				options: ["A", "B"],
				answer: "A",
				explanation: "",
				topic: "Arquitetura",
			},
			0,
			1,
			{
				reviewTopics: ["Arquitetura"],
				onAgentEvent,
				createAgentRunId: () => "review-q1",
			},
		);

		expect(result).toEqual({
			question: {
				question: "O que e cache?",
				options: ["A", "B"],
				answer: "A",
				explanation: "",
				topic: "Arquitetura",
			},
			success: true,
		});
	});

	it("emits a warning and reports failure when reviewer tool calls error out and no review is applied", async () => {
		streamChatMessagesMock.mockImplementation(
			(
				_config: unknown,
				_messages: unknown,
				options?: { tools?: readonly unknown[] },
			) =>
				(async function* () {
					const listQuestions = getTool(
						options?.tools,
						"list_extracted_questions",
					);

					await listQuestions.execute({});
					yield {
						type: "TOOL_CALL_END",
						toolCallId: "tool-review-fail-1",
						toolCallName: "update_extracted_question",
						input: {
							questionId: "q1",
							question: null,
							options: null,
							answer: null,
						},
						result:
							'{"error":"Input validation failed for tool update_extracted_question: Validation failed: Invalid input: expected array, received null"}',
					};

					yield {
						type: "RUN_FINISHED",
						threadId: "thread-1",
						runId: "run-1",
						finishReason: "stop",
					};
				})(),
		);

		const onAgentEvent = vi.fn();

		const result = await reviewSingleQuestion(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
			},
			"Texto original da prova",
			{
				question: "O que e cache?",
				options: ["A", "B"],
				answer: "A",
				explanation: "",
				topic: "Arquitetura",
			},
			0,
			1,
			{
				reviewTopics: ["Arquitetura"],
				onAgentEvent,
				createAgentRunId: () => "review-q1",
			},
		);

		expect(result).toEqual({
			question: {
				question: "O que e cache?",
				options: ["A", "B"],
				answer: "A",
				explanation: "",
				topic: "Arquitetura",
			},
			success: false,
			reason:
				"Input validation failed for tool update_extracted_question: Validation failed: Invalid input: expected array, received null",
		});
		expect(onAgentEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: "warning",
				agentRunId: "review-q1",
				warning: expect.stringContaining("Keeping the original extracted question"),
			}),
		);
	});
});
