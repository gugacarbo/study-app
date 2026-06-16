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

import type { DraftQuestion } from "@/features/ai/agents/improve-questions/contracts";
import { improveSingleQuestion } from "@/features/ai/agents/improve-questions/improve-single-question";

type ExecutableTool = {
	execute: (
		input: Record<string, unknown>,
		context?: { toolCallId?: string },
	) => Promise<unknown>;
};

function getTool(tools: ToolSet | undefined, name: string): ExecutableTool {
	const tool = tools?.[name] as ExecutableTool | undefined;
	if (!tool?.execute) throw new Error(`Tool ${name} not found`);
	return tool;
}

const baseQuestion: DraftQuestion = {
	id: 7,
	question: "Qual e a capital do Brasil?",
	options: ["Sao Paulo", "Rio de Janeiro", "Brasilia", "Salvador", "Recife"],
	answers: ["Brasilia"],
	scoringMode: "exact",
	explanation: "Brasilia e a capital federal.",
	topic: "Geografia",
};

describe("improveSingleQuestion", () => {
	beforeEach(() => {
		streamTextMock.mockReset();
	});

	it("improves a question through workspace tools and emits workspace updates", async () => {
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const getQuestion = getTool(options?.tools, "get_question");
			const updateQuestionOptions = getTool(
				options?.tools,
				"update_question_options",
			);

			return {
				fullStream: (async function* () {
					yield {
						type: "text-delta",
						text: "Melhorando os distratores...",
					} as TextStreamPart<ToolSet>;

					await getQuestion.execute({ id: 7 });
					yield {
						type: "tool-result",
						toolCallId: "tool-1",
						toolName: "get_question",
						input: { id: 7 },
						output: {
							ok: true,
							data: {
								id: 7,
								question: baseQuestion.question,
								options: baseQuestion.options,
								answers: baseQuestion.answers,
								scoringMode: baseQuestion.scoringMode,
								explanation: baseQuestion.explanation,
							},
						},
					} as TextStreamPart<ToolSet>;

					await updateQuestionOptions.execute({
						id: 7,
						options: [
							"Sao Paulo",
							"Rio de Janeiro",
							"Brasilia",
							"Salvador",
							"Belo Horizonte",
						],
						explanation: "Brasilia foi inaugurada em 1960 como capital federal.",
					});
					yield {
						type: "tool-result",
						toolCallId: "tool-2",
						toolName: "update_question_options",
						input: {
							id: 7,
							options: [
								"Sao Paulo",
								"Rio de Janeiro",
								"Brasilia",
								"Salvador",
								"Belo Horizonte",
							],
							explanation:
								"Brasilia foi inaugurada em 1960 como capital federal.",
						},
						output: {
							ok: true,
							id: 7,
							updatedFields: ["options", "explanation"],
						},
					} as TextStreamPart<ToolSet>;

					yield {
						type: "finish-step",
						usage: {
							inputTokens: 14,
							outputTokens: 9,
							totalTokens: 23,
						},
					} as TextStreamPart<ToolSet>;
				})(),
			};
		});

		const onAgentEvent = vi.fn();
		const onWorkspaceUpdate = vi.fn();
		const webTools = {
			web_search: {
				description: "Search the web",
				execute: vi.fn(),
			},
		} as unknown as ToolSet;

		const result = await improveSingleQuestion(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			baseQuestion,
			{
				tools: webTools,
				onAgentEvent,
				onWorkspaceUpdate,
				createAgentRunId: () => "improve-q7",
			},
		);

		expect(result.success).toBe(true);
		if (!result.success) return;

		expect(result.question).toEqual({
			...baseQuestion,
			options: [
				"Sao Paulo",
				"Rio de Janeiro",
				"Brasilia",
				"Salvador",
				"Belo Horizonte",
			],
			explanation: "Brasilia foi inaugurada em 1960 como capital federal.",
		});
		expect(result.agentRun).toEqual(
			expect.objectContaining({
				agentRunId: "improve-q7",
				status: "done",
				systemPrompt: expect.stringContaining(
					"You are an exam-question specialist.",
				),
				userPrompt: expect.stringContaining("Improve question #7."),
			}),
		);
		expect(streamTextMock).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					{
						role: "user",
						content: expect.stringContaining("Improve question #7."),
					},
				],
				tools: expect.objectContaining({
					get_question: expect.objectContaining({ execute: expect.any(Function) }),
					update_question_options: expect.objectContaining({
						execute: expect.any(Function),
					}),
					web_search: expect.objectContaining({ execute: expect.any(Function) }),
				}),
				system: expect.stringContaining(
					"You are an exam-question specialist.",
				),
			}),
		);
		expect(onWorkspaceUpdate).toHaveBeenCalledWith({
			question: {
				...baseQuestion,
				options: [
					"Sao Paulo",
					"Rio de Janeiro",
					"Brasilia",
					"Salvador",
					"Belo Horizonte",
				],
				explanation: "Brasilia foi inaugurada em 1960 como capital federal.",
			},
			updatedFields: ["options", "explanation"],
		});
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				eventType: "lifecycle",
				stageId: "improve-questions",
				status: "pending",
				agentRunId: "improve-q7",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				eventType: "lifecycle",
				stageId: "improve-questions",
				status: "running",
				agentRunId: "improve-q7",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({
				eventType: "token",
				stageId: "improve-questions",
				agentRunId: "improve-q7",
				rawText: "Melhorando os distratores...",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			4,
			expect.objectContaining({
				eventType: "tool-call",
				stageId: "improve-questions",
				agentRunId: "improve-q7",
				name: "get_question",
				state: "input-complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			5,
			expect.objectContaining({
				eventType: "tool-result",
				stageId: "improve-questions",
				agentRunId: "improve-q7",
				content: {
					ok: true,
					data: {
						id: 7,
						question: baseQuestion.question,
						options: baseQuestion.options,
						answers: baseQuestion.answers,
						scoringMode: baseQuestion.scoringMode,
						explanation: baseQuestion.explanation,
					},
				},
				state: "complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			6,
			expect.objectContaining({
				eventType: "tool-call",
				stageId: "improve-questions",
				agentRunId: "improve-q7",
				name: "update_question_options",
				state: "input-complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			7,
			expect.objectContaining({
				eventType: "tool-result",
				stageId: "improve-questions",
				agentRunId: "improve-q7",
				content: {
					ok: true,
					id: 7,
					updatedFields: ["options", "explanation"],
				},
				state: "complete",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			8,
			expect.objectContaining({
				eventType: "token",
				stageId: "improve-questions",
				agentRunId: "improve-q7",
				tokens: {
					inputTokens: 14,
					outputTokens: 9,
					totalTokens: 23,
				},
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			9,
			expect.objectContaining({
				eventType: "lifecycle",
				stageId: "improve-questions",
				status: "done",
				agentRunId: "improve-q7",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			10,
			expect.objectContaining({
				eventType: "result",
				stageId: "improve-questions",
				agentRunId: "improve-q7",
				finalObject: expect.objectContaining({ id: 7 }),
			}),
		);
	});

	it("emits tool results from onToolExecuted when the stream payload is empty", async () => {
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const getQuestion = getTool(options?.tools, "get_question");

			return {
				fullStream: (async function* () {
					await getQuestion.execute({ id: 7 }, { toolCallId: "tool-1" });
					yield {
						type: "tool-call",
						toolCallId: "tool-1",
						toolName: "get_question",
						input: { id: 7 },
					} as TextStreamPart<ToolSet>;
					yield {
						type: "tool-result",
						toolCallId: "tool-1",
						toolName: "get_question",
						input: { id: 7 },
						output: undefined,
					} as TextStreamPart<ToolSet>;
					yield {
						type: "finish-step",
						usage: {
							inputTokens: 1,
							outputTokens: 1,
							totalTokens: 2,
						},
					} as TextStreamPart<ToolSet>;
				})(),
			};
		});

		const onAgentEvent = vi.fn();

		const result = await improveSingleQuestion(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			baseQuestion,
			{
				onAgentEvent,
				createAgentRunId: () => "improve-q7",
			},
		);

		expect(result.success).toBe(true);
		expect(onAgentEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: "tool-result",
				name: "get_question",
				content: {
					ok: true,
					data: expect.objectContaining({ id: 7 }),
				},
				state: "complete",
				meta: expect.objectContaining({ toolCallId: "tool-1" }),
			}),
		);
	});

	it("reports failure when tool calls error out and no update is applied", async () => {
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const updateQuestionOptions = getTool(
				options?.tools,
				"update_question_options",
			);

			return {
				fullStream: (async function* () {
					await updateQuestionOptions.execute({
						id: 7,
						options: ["A", "B"],
					});
					yield {
						type: "tool-result",
						toolCallId: "tool-fail-1",
						toolName: "update_question_options",
						input: { id: 7, options: ["A", "B"] },
						output: {
							ok: false,
							error: {
								code: "IMPROVE_QUESTIONS_TOOL_ERROR",
								message: "At least 5 options required",
							},
						},
					} as TextStreamPart<ToolSet>;
				})(),
			};
		});

		const onAgentEvent = vi.fn();
		const onWorkspaceUpdate = vi.fn();

		const result = await improveSingleQuestion(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			baseQuestion,
			{
				onAgentEvent,
				onWorkspaceUpdate,
				createAgentRunId: () => "improve-q7",
			},
		);

		expect(result).toEqual({
			question: baseQuestion,
			success: false,
			reason: "At least 5 options required",
			agentRun: expect.objectContaining({
				agentRunId: "improve-q7",
				status: "error",
				error: "At least 5 options required",
			}),
		});
		expect(onWorkspaceUpdate).not.toHaveBeenCalled();
		expect(onAgentEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: "lifecycle",
				stageId: "improve-questions",
				status: "error",
				agentRunId: "improve-q7",
			}),
		);
	});
});
