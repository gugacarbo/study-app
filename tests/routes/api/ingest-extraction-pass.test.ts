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


import { runExtractionPass } from "@/routes/api/ingest/-extraction-pass";

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

function mockStreamParts(parts: TextStreamPart<ToolSet>[]) {
	streamTextMock.mockReturnValue({
		fullStream: (async function* () {
			for (const part of parts) {
				yield part;
			}
		})(),
		toUIMessageStream: vi.fn(() => (async function* () {})()),
	});
}

function createAgentRunsMock() {
	return {
		createRun: vi.fn(() => ({
			stageId: "initial_extraction",
			agentRunId: "initial_extraction-1",
			label: "Initial extraction agent",
		})),
		lifecycle: vi.fn(),
		result: vi.fn(),
		token: vi.fn(),
		textDelta: vi.fn(),
		reasoningDelta: vi.fn(),
		toolCall: vi.fn(),
		toolResult: vi.fn(),
	};
}

describe("runExtractionPass", () => {
	beforeEach(() => {
		streamTextMock.mockReset();
	});

	it("builds the final ingest result from tool calls", async () => {
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const addQuestion = getTool(options?.tools, "add_extracted_question");
			return {
				fullStream: (async function* () {
					await addQuestion.execute(
						{
							question: "O que e cache?",
							options: ["Memoria rapida", "Disco rigido"],
							answer: "Memoria rapida",
							topic: "Memoria",
						},
						{ toolCallId: "tc-1" },
					);
					yield {
						type: "tool-result",
						toolCallId: "tc-1",
						toolName: "add_extracted_question",
						input: {
							question: "O que e cache?",
							options: ["Memoria rapida", "Disco rigido"],
							answer: "Memoria rapida",
							topic: "Memoria",
						},
						output: { ok: true },
					} as TextStreamPart<ToolSet>;
				})(),
				toUIMessageStream: vi.fn(() => (async function* () {})()),
			};
		});

		const onWarning = vi.fn();
		const agentRuns = createAgentRunsMock();
		const log = { error: vi.fn() };

		const result = await runExtractionPass({
			text: "Texto da prova",
			fileName: "ENEM_2023_Linguagens.pdf",
			config: {
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			criticalTopics: [],
			agentRuns,
			onWarning,
			log,
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
		});

		expect(result).toEqual({
			examName: "ENEM 2023 Linguagens",
			questions: [
				{
					question: "O que e cache?",
					options: ["Memoria rapida", "Disco rigido"],
					answers: ["Memoria rapida"],
					scoringMode: "exact",
					deepExplanation: undefined,
					explanation: "",
					topic: "Memoria",
				},
			],
			topics: ["Memoria"],
		});
		expect(agentRuns.result).toHaveBeenCalledWith(
			expect.objectContaining({
				agentRunId: "initial_extraction-1",
				stageId: "initial_extraction",
				label: "Initial extraction agent",
			}),
			result,
			expect.stringContaining("[tool:add_extracted_question]"),
			{ toolQuestionCount: 1 },
		);
		expect(agentRuns.toolCall).toHaveBeenCalledWith(
			expect.objectContaining({
				agentRunId: "initial_extraction-1",
			}),
			{
				name: "add_extracted_question",
				arguments: JSON.stringify({
					question: "O que e cache?",
					options: ["Memoria rapida", "Disco rigido"],
					answer: "Memoria rapida",
					topic: "Memoria",
				}),
				input: {
					question: "O que e cache?",
					options: ["Memoria rapida", "Disco rigido"],
					answer: "Memoria rapida",
					topic: "Memoria",
				},
				state: "input-complete",
			},
			{ toolCallId: "tc-1" },
		);
		expect(agentRuns.toolResult).toHaveBeenCalledWith(
			expect.objectContaining({
				agentRunId: "initial_extraction-1",
			}),
			expect.objectContaining({
				content: expect.objectContaining({ ok: true }),
				state: "complete",
			}),
			{ toolCallId: "tc-1" },
		);
	});

	it("supports add followed by update on the same question", async () => {
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const addQuestion = getTool(options?.tools, "add_extracted_question");
			const updateQuestion = getTool(options?.tools, "update_extracted_question");
			return {
				fullStream: (async function* () {
					await addQuestion.execute({
						question: "Questao original",
						options: ["A", "B"],
						answer: "A",
						topic: "Topico 1",
					});
					await updateQuestion.execute({
						questionId: "q1",
						question: "Questao corrigida",
						topic: "Topico 2",
					});
				})(),
				toUIMessageStream: vi.fn(() => (async function* () {})()),
			};
		});

		const result = await runExtractionPass({
			text: "Texto da prova",
			fileName: "prova-redes.txt",
			config: {
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			criticalTopics: [],
			agentRuns: createAgentRunsMock(),
			onWarning: vi.fn(),
			log: { error: vi.fn() },
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
		});

		expect(result).toEqual({
			examName: "prova redes",
			questions: [
				{
					question: "Questao corrigida",
					options: ["A", "B"],
					answers: ["A"],
					scoringMode: "exact",
					deepExplanation: undefined,
					explanation: "",
					topic: "Topico 2",
				},
			],
			topics: ["Topico 2"],
		});
	});

	it("deduplicates repeated tool transcript lines for the same toolCallId", async () => {
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const addQuestion = getTool(options?.tools, "add_extracted_question");
			return {
				fullStream: (async function* () {
					await addQuestion.execute({
						question: "Questao unica",
						options: ["A", "B"],
						answer: "A",
						topic: "Geral",
					});
					yield {
						type: "tool-result",
						toolCallId: "tc-dedupe-1",
						toolName: "add_extracted_question",
						input: {
							question: "Questao unica",
							options: ["A", "B"],
							answer: "A",
							topic: "Geral",
						},
						output: { ok: false, error: { message: "retry" } },
					} as TextStreamPart<ToolSet>;
					yield {
						type: "tool-result",
						toolCallId: "tc-dedupe-1",
						toolName: "add_extracted_question",
						input: {
							question: "Questao unica",
							options: ["A", "B"],
							answer: "A",
							topic: "Geral",
						},
						output: { ok: true, questionId: "q1" },
					} as TextStreamPart<ToolSet>;
				})(),
				toUIMessageStream: vi.fn(() => (async function* () {})()),
			};
		});

		const agentRuns = createAgentRunsMock();

		await runExtractionPass({
			text: "Texto da prova",
			fileName: "exam.txt",
			config: {
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			criticalTopics: [],
			agentRuns,
			onWarning: vi.fn(),
			log: { error: vi.fn() },
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
		});

		const rawText = agentRuns.result.mock.calls[0]?.[2];
		const toolMatches =
			String(rawText).match(/\[tool:add_extracted_question\]/g) ?? [];

		expect(toolMatches).toHaveLength(1);
	});

	it("warns when more than one question is extracted", async () => {
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const addQuestion = getTool(options?.tools, "add_extracted_question");
			return {
				fullStream: (async function* () {
					await addQuestion.execute({
						question: "Questao 1",
						options: ["A", "B"],
						answer: "A",
						topic: "Geral",
					});
					await addQuestion.execute({
						question: "Questao 2",
						options: ["A", "B"],
						answer: "B",
						topic: "Geral",
					});
				})(),
				toUIMessageStream: vi.fn(() => (async function* () {})()),
			};
		});

		const onWarning = vi.fn();
		await runExtractionPass({
			text: "Texto da prova",
			fileName: "exam.txt",
			config: {
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			criticalTopics: [],
			agentRuns: createAgentRunsMock(),
			onWarning,
			log: { error: vi.fn() },
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
		});

		expect(onWarning).toHaveBeenCalledWith(
			"Extracted 2 questions — verify the count matches the source exam.",
		);
	});

	it("throws and warns when no question is added", async () => {
		mockStreamParts([]);

		const onWarning = vi.fn();

		await expect(
			runExtractionPass({
				text: "Sem questoes",
				fileName: "exam.txt",
				config: {
					model: "openai/gpt-4o-mini",
					baseUrl: "https://openrouter.ai/api/v1",
					apiKey: "test-key",
				},
				criticalTopics: [],
				agentRuns: createAgentRunsMock(),
				onWarning,
				log: { error: vi.fn() },
				stageId: "initial_extraction",
				stageLabel: "Initial extraction agent",
			}),
		).rejects.toThrow(
			"No questions were extracted during the initial ingest pass.",
		);
		expect(onWarning).toHaveBeenCalledWith(
			"No questions were extracted during the initial ingest pass.",
		);
	});

	it("emits incremental tool-call events while arguments stream", async () => {
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const addQuestion = getTool(options?.tools, "add_extracted_question");
			return {
				fullStream: (async function* () {
					yield {
						type: "tool-input-start",
						id: "tc-stream-1",
						toolName: "add_extracted_question",
					} as TextStreamPart<ToolSet>;
					yield {
						type: "tool-input-delta",
						id: "tc-stream-1",
						delta: '{"question":"Qual e a derivada?"',
					} as TextStreamPart<ToolSet>;
					yield {
						type: "tool-input-delta",
						id: "tc-stream-1",
						delta: ',"answer":"2x"}',
					} as TextStreamPart<ToolSet>;
					await addQuestion.execute({
						question: "Qual e a derivada?",
						answer: "2x",
						options: ["1", "2x"],
						topic: "Calculo",
					});
					yield {
						type: "tool-call",
						toolCallId: "tc-stream-1",
						toolName: "add_extracted_question",
						input: {
							question: "Qual e a derivada?",
							answer: "2x",
							options: ["1", "2x"],
							topic: "Calculo",
						},
					} as TextStreamPart<ToolSet>;
					yield {
						type: "tool-result",
						toolCallId: "tc-stream-1",
						toolName: "add_extracted_question",
						input: {
							question: "Qual e a derivada?",
							answer: "2x",
							options: ["1", "2x"],
							topic: "Calculo",
						},
						output: { ok: true, questionId: "q1" },
					} as TextStreamPart<ToolSet>;
				})(),
				toUIMessageStream: vi.fn(() => (async function* () {})()),
			};
		});

		const agentRuns = createAgentRunsMock();
		await runExtractionPass({
			text: "Texto da prova",
			fileName: "exam.txt",
			config: {
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			criticalTopics: [],
			agentRuns,
			onWarning: vi.fn(),
			log: { error: vi.fn() },
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
		});

		expect(agentRuns.toolCall).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ agentRunId: "initial_extraction-1" }),
			expect.objectContaining({
				name: "add_extracted_question",
				state: "awaiting-input",
			}),
			{ toolCallId: "tc-stream-1" },
		);
		expect(agentRuns.toolCall).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ agentRunId: "initial_extraction-1" }),
			expect.objectContaining({
				name: "add_extracted_question",
				arguments: '{"question":"Qual e a derivada?"',
				state: "input-streaming",
			}),
			{ toolCallId: "tc-stream-1" },
		);
		expect(agentRuns.toolCall).toHaveBeenNthCalledWith(
			4,
			expect.objectContaining({ agentRunId: "initial_extraction-1" }),
			expect.objectContaining({
				name: "add_extracted_question",
				state: "input-complete",
			}),
			{ toolCallId: "tc-stream-1" },
		);
	});
});
