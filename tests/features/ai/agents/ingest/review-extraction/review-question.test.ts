import type { TextStreamPart, ToolSet } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { streamTextMock } = vi.hoisted(() => ({
	streamTextMock: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>();
	return {
		...actual,
		streamText: streamTextMock,
	};
});

vi.mock("@/features/ai/adapters/provider-model", () => ({
	getAiModel: vi.fn(() => "mock-model"),
}));

vi.mock("@/features/ai/core/ai-stream-handler", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/features/ai/core/ai-stream-handler")>();
	return {
		...actual,
		processAiStreamPart(
			chunk: Parameters<typeof actual.processAiStreamPart>[0],
			handlers: Parameters<typeof actual.processAiStreamPart>[1],
			state: Parameters<typeof actual.processAiStreamPart>[2],
		) {
			const { onToolResult, ...restHandlers } = handlers;
			if (onToolResult) {
				return actual.processAiStreamPart(
					chunk,
					restHandlers,
					state,
					onToolResult,
				);
			}
			return actual.processAiStreamPart(chunk, handlers, state);
		},
	};
});

import { reviewSingleQuestion } from "@/features/ai/agents/ingest/review-extraction/review-question";

type ExecutableTool = {
	execute: (input: Record<string, unknown>) => Promise<unknown>;
};

function getTool(tools: ToolSet | undefined, name: string): ExecutableTool {
	const tool = tools?.[name] as ExecutableTool | undefined;
	if (!tool?.execute) throw new Error(`Tool ${name} not found`);
	return tool;
}

describe("reviewSingleQuestion", () => {
	beforeEach(() => {
		streamTextMock.mockReset();
	});

	it("reviews a question through workspace tools and forwards tool events", async () => {
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const listQuestions = getTool(options?.tools, "list_extracted_questions");
			const updateQuestion = getTool(options?.tools, "update_extracted_question");

			return {
				fullStream: (async function* () {
					yield {
						type: "text-delta",
						text: "Conferindo a questao extraida...",
					} as TextStreamPart<ToolSet>;

					await listQuestions.execute({});
					yield {
						type: "tool-result",
						toolCallId: "tool-1",
						toolName: "list_extracted_questions",
						input: {},
						output: {
							ok: true,
							totalQuestions: 1,
							data: [
								{
									questionId: "q1",
									question: "O que e cache?",
									options: ["A", "B"],
									answers: ["A"],
									scoringMode: "exact",
									topic: "Arquitetura",
								},
							],
						},
					} as TextStreamPart<ToolSet>;

					await updateQuestion.execute({
						questionId: "q1",
						answers: ["Memoria rapida"],
						options: ["Memoria rapida", "Disco"],
					});
					yield {
						type: "tool-result",
						toolCallId: "tool-2",
						toolName: "update_extracted_question",
						input: {
							questionId: "q1",
							answers: ["Memoria rapida"],
							options: ["Memoria rapida", "Disco"],
						},
						output: {
							ok: true,
							questionId: "q1",
							updatedFields: ["answers", "options"],
						},
					} as TextStreamPart<ToolSet>;

					yield {
						type: "finish-step",
						usage: {
							inputTokens: 12,
							outputTokens: 8,
							totalTokens: 20,
						},
					} as TextStreamPart<ToolSet>;
				})(),
			};
		});

		const onAgentEvent = vi.fn();
		const webTools = {
			web_search: {
				description: "Search the web",
				execute: vi.fn(),
			},
		} as unknown as ToolSet;

		const result = await reviewSingleQuestion(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			"Texto original da prova",
			{
				question: "O que e cache?",
				options: ["A", "B"],
				answers: ["A"],
				scoringMode: "exact",
				explanation: "",
				topic: "Arquitetura",
			},
			0,
			1,
			{
				reviewTopics: ["Arquitetura"],
				tools: webTools,
				onAgentEvent,
				createAgentRunId: () => "review-q1",
			},
		);

		expect(result).toEqual({
			question: {
				question: "O que e cache?",
				options: ["Memoria rapida", "Disco"],
				answers: ["Memoria rapida"],
				scoringMode: "exact",
				explanation: "",
				topic: "Arquitetura",
			},
			success: true,
		});
		expect(streamTextMock).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					{
						role: "user",
						content: expect.stringContaining("Review extracted question #1."),
					},
				],
				tools: expect.objectContaining({
					list_extracted_questions: expect.objectContaining({
						execute: expect.any(Function),
					}),
					update_extracted_question: expect.objectContaining({
						execute: expect.any(Function),
					}),
					web_search: expect.objectContaining({
						execute: expect.any(Function),
					}),
				}),
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
				eventType: "token",
				agentRunId: "review-q1",
				rawText: "Conferindo a questao extraida...",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			4,
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
			5,
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
							answers: ["A"],
							scoringMode: "exact",
							topic: "Arquitetura",
						},
					],
				},
				state: "complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			6,
			expect.objectContaining({
				eventType: "tool-call",
				agentRunId: "review-q1",
				name: "update_extracted_question",
				arguments: JSON.stringify({
					questionId: "q1",
					answers: ["Memoria rapida"],
					options: ["Memoria rapida", "Disco"],
				}),
				state: "input-complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			7,
			expect.objectContaining({
				eventType: "tool-result",
				agentRunId: "review-q1",
				content: {
					ok: true,
					questionId: "q1",
					updatedFields: ["answers", "options"],
				},
				state: "complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			8,
			expect.objectContaining({
				eventType: "token",
				agentRunId: "review-q1",
				tokens: {
					inputTokens: 12,
					outputTokens: 8,
					totalTokens: 20,
				},
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			9,
			expect.objectContaining({
				eventType: "result",
				agentRunId: "review-q1",
				rawText: expect.stringContaining("[tool:update_extracted_question]"),
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			10,
			expect.objectContaining({
				eventType: "lifecycle",
				status: "done",
				agentRunId: "review-q1",
			}),
		);
	});

	it("deduplicates repeated tool transcript lines for the same reviewer toolCallId", async () => {
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const updateQuestion = getTool(options?.tools, "update_extracted_question");

			return {
				fullStream: (async function* () {
					await updateQuestion.execute({
						questionId: "q1",
						answers: ["Memoria rapida"],
					});
					yield {
						type: "tool-result",
						toolCallId: "tool-review-dedupe-1",
						toolName: "update_extracted_question",
						input: {
							questionId: "q1",
							answers: ["Memoria rapida"],
						},
						output: {
							ok: false,
							error: { message: "retry" },
						},
					} as TextStreamPart<ToolSet>;
					yield {
						type: "tool-result",
						toolCallId: "tool-review-dedupe-1",
						toolName: "update_extracted_question",
						input: {
							questionId: "q1",
							answers: ["Memoria rapida"],
						},
						output: {
							ok: true,
							questionId: "q1",
							updatedFields: ["answers"],
						},
					} as TextStreamPart<ToolSet>;
				})(),
			};
		});

		const onAgentEvent = vi.fn();

		await reviewSingleQuestion(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			"Texto original da prova",
			{
				question: "O que e cache?",
				options: ["A", "B"],
				answers: ["A"],
				scoringMode: "exact",
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
			String(resultEvent?.rawText).match(/\[tool:update_extracted_question\]/g) ??
			[];

		expect(toolMatches).toHaveLength(1);
	});

	it("succeeds when reviewer sends an all-null update for an already correct question", async () => {
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const listQuestions = getTool(options?.tools, "list_extracted_questions");
			const updateQuestion = getTool(options?.tools, "update_extracted_question");

			return {
				fullStream: (async function* () {
					await listQuestions.execute({});
					yield {
						type: "tool-result",
						toolCallId: "tool-review-noop-1",
						toolName: "list_extracted_questions",
						input: {},
						output: {
							ok: true,
							data: [
								{
									questionId: "q1",
									question: "O que e cache?",
									answers: ["A"],
									scoringMode: "exact",
									topic: "Arquitetura",
								},
							],
						},
					} as TextStreamPart<ToolSet>;

					await updateQuestion.execute({
						questionId: "q1",
						question: null,
						options: null,
						answers: null,
						topic: null,
						explanation: null,
					});
					yield {
						type: "tool-result",
						toolCallId: "tool-review-noop-2",
						toolName: "update_extracted_question",
						input: {
							questionId: "q1",
							question: null,
							options: null,
							answers: null,
							topic: null,
							explanation: null,
						},
						output: {
							ok: true,
							questionId: "q1",
							updatedFields: [],
						},
					} as TextStreamPart<ToolSet>;
				})(),
			};
		});

		const onAgentEvent = vi.fn();

		const result = await reviewSingleQuestion(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			"Texto original da prova",
			{
				question: "O que e cache?",
				options: ["A", "B"],
				answers: ["A"],
				scoringMode: "exact",
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
				answers: ["A"],
				scoringMode: "exact",
				explanation: "",
				topic: "Arquitetura",
			},
			success: true,
		});
	});

	it("emits a warning and reports failure when reviewer tool calls error out and no review is applied", async () => {
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const listQuestions = getTool(options?.tools, "list_extracted_questions");

			return {
				fullStream: (async function* () {
					await listQuestions.execute({});
					yield {
						type: "tool-result",
						toolCallId: "tool-review-fail-1",
						toolName: "update_extracted_question",
						input: {
							questionId: "q1",
							question: null,
							options: null,
							answers: null,
						},
						output:
							'{"error":"Input validation failed for tool update_extracted_question: Validation failed: Invalid input: expected array, received null"}',
					} as TextStreamPart<ToolSet>;
				})(),
			};
		});

		const onAgentEvent = vi.fn();

		const result = await reviewSingleQuestion(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			"Texto original da prova",
			{
				question: "O que e cache?",
				options: ["A", "B"],
				answers: ["A"],
				scoringMode: "exact",
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
				answers: ["A"],
				scoringMode: "exact",
				deepExplanation: undefined,
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
