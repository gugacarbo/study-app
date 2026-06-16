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
import {
	createExtractionWorkspace,
	createIngestExtractionTools,
} from "@/features/ai/tools/ingest-tools";

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

describe("reviewSingleQuestion", () => {
	beforeEach(() => {
		streamTextMock.mockReset();
	});

	it("reviews a question through workspace tools and forwards tool events", async () => {
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const updateQuestion = getTool(options?.tools, "update_extracted_question");

			return {
				fullStream: (async function* () {
					yield {
						type: "text-delta",
						text: "Conferindo a questao extraida...",
					} as TextStreamPart<ToolSet>;

					await updateQuestion.execute({
						questionId: "q1",
						answers: ["Memoria rapida"],
						options: ["Memoria rapida", "Disco"],
					});
					yield {
						type: "tool-result",
						toolCallId: "tool-1",
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
					update_extracted_question: expect.objectContaining({
						execute: expect.any(Function),
					}),
					report_agent_stage_status: expect.objectContaining({
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
			5,
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
			6,
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
			7,
			expect.objectContaining({
				eventType: "result",
				agentRunId: "review-q1",
				rawText: expect.stringContaining("[tool:update_extracted_question]"),
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			8,
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
			const updateQuestion = getTool(options?.tools, "update_extracted_question");

			return {
				fullStream: (async function* () {
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
						toolCallId: "tool-review-noop-1",
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

	it("lists the seeded review question from the workspace", async () => {
		const workspace = createExtractionWorkspace({
			questions: [
				{
					questionId: "q1",
					question:
						"8. Em uma arvore binaria, as estruturas T1 e T2 associadas a raiz representam:",
					options: [
						"Pai e avo da raiz.",
						"Subarvore esquerda e subarvore direita.",
					],
					answers: ["Subarvore esquerda e subarvore direita."],
					scoringMode: "exact",
					explanation: "",
					topic: "General",
				},
			],
			nextQuestionNumber: 2,
		});
		const tools = createIngestExtractionTools(workspace);
		const listQuestions = getTool(tools, "list_extracted_questions");
		const result = (await listQuestions.execute(
			{},
			{ toolCallId: "tc-review-list" },
		)) as {
			ok: boolean;
			totalQuestions: number;
			data: Array<{ questionId: string }>;
		};

		expect(result).toMatchObject({
			ok: true,
			totalQuestions: 1,
			data: [{ questionId: "q1" }],
		});
	});

	it("uses workspace questionId q3 for the third extracted question", async () => {
		streamTextMock.mockImplementation(() => ({
			fullStream: (async function* () {
				yield {
					type: "finish-step",
					usage: { inputTokens: 1, outputTokens: 1 },
				} as TextStreamPart<ToolSet>;
			})(),
		}));

		await reviewSingleQuestion(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			"Texto original da prova",
			{
				question: "Terceira questao?",
				options: ["A", "B"],
				answers: ["A"],
				scoringMode: "exact",
				explanation: "",
				topic: "Topico",
			},
			2,
			5,
			{
				reviewTopics: [],
				createAgentRunId: () => "review-q3",
			},
		);

		const call = streamTextMock.mock.calls[0]?.[0] as
			| {
					messages?: Array<{ content?: string }>;
					system?: string;
			  }
			| undefined;

		expect(call?.messages?.[0]?.content).toContain('questionId "q3"');
		expect(call?.system).toContain('questionId "q3"');
	});

	it("does not expose list or add tools to the review agent", async () => {
		streamTextMock.mockImplementation(() => ({
			fullStream: (async function* () {
				yield {
					type: "finish-step",
					usage: { inputTokens: 1, outputTokens: 1 },
				} as TextStreamPart<ToolSet>;
			})(),
		}));

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
				createAgentRunId: () => "review-q1",
			},
		);

		const call = streamTextMock.mock.calls[0]?.[0] as
			| { tools?: ToolSet }
			| undefined;
		expect(call?.tools?.list_extracted_questions).toBeUndefined();
		expect(call?.tools?.add_extracted_question).toBeUndefined();
		expect(call?.tools?.update_extracted_question).toBeDefined();
		expect(call?.tools?.report_agent_stage_status).toBeDefined();
	});

	it("forwards update_extracted_question via onToolExecuted when stream omits tool-result chunks", async () => {
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const updateQuestion = getTool(options?.tools, "update_extracted_question");

			return {
				fullStream: (async function* () {
					yield {
						type: "tool-call",
						toolCallId: "tool-update-only",
						toolName: "update_extracted_question",
						input: {
							questionId: "q1",
							topic: "Arvores Binarias",
						},
					} as TextStreamPart<ToolSet>;
					await updateQuestion.execute(
						{
							questionId: "q1",
							topic: "Arvores Binarias",
						},
						{ toolCallId: "tool-update-only" },
					);
					yield {
						type: "finish-step",
						usage: { inputTokens: 10, outputTokens: 5 },
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

		const updateResult = onAgentEvent.mock.calls.find(
			([event]) =>
				event?.eventType === "tool-result" &&
				event?.meta?.toolCallId === "tool-update-only",
		)?.[0];

		expect(updateResult?.content).toMatchObject({
			ok: true,
			questionId: "q1",
			updatedFields: ["topic"],
		});
		expect(result).toMatchObject({
			success: true,
			question: expect.objectContaining({ topic: "Arvores Binarias" }),
		});
	});

	it("emits a warning and reports failure when reviewer tool calls error out and no review is applied", async () => {
		streamTextMock.mockImplementation(() => ({
			fullStream: (async function* () {
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
		}));

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
