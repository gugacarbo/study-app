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

async function yieldStageStatusReport(
	tools: ToolSet | undefined,
	message: string,
	toolCallId = "tc-stage-status",
): Promise<TextStreamPart<ToolSet>> {
	const reportStage = getTool(tools, "report_agent_stage_status");
	const input = { status: "success", message };
	const output = { ok: true, status: "success", message };
	await reportStage.execute(input, { toolCallId });
	return {
		type: "tool-result",
		toolCallId,
		toolName: "report_agent_stage_status",
		input,
		output,
	} as TextStreamPart<ToolSet>;
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
		allocateAgentRunId: vi.fn(() => "initial_extraction-1"),
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
		warning: vi.fn(),
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
					yield await yieldStageStatusReport(
						options?.tools,
						"Extracted 1 question.",
					);
				})(),
				toUIMessageStream: vi.fn(() => (async function* () {})()),
			};
		});

		const onWarning = vi.fn();
		const agentRuns = createAgentRunsMock();
		const log = { error: vi.fn() };

		const pass = await runExtractionPass({
			text: "Texto da prova",
			fileName: "ENEM_2023_Linguagens.pdf",
			config: {
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			agentRuns,
			onWarning,
			log,
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
		});

		const result = pass.result;

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
			{
				toolQuestionCount: 1,
				stageStatusMessage: "Extracted 1 question.",
			},
		);
		expect(agentRuns.toolCall).toHaveBeenCalledWith(
			expect.objectContaining({
				agentRunId: "initial_extraction-1",
			}),
			expect.objectContaining({
				name: "add_extracted_question",
				state: "input-complete",
			}),
			expect.objectContaining({
				toolCallId: "tc-1",
			}),
		);
		expect(agentRuns.toolResult).toHaveBeenCalledWith(
			expect.objectContaining({
				agentRunId: "initial_extraction-1",
			}),
			expect.objectContaining({
				content: expect.objectContaining({ ok: true }),
				state: "complete",
			}),
			expect.objectContaining({
				toolCallId: "tc-1",
			}),
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
					yield await yieldStageStatusReport(
						options?.tools,
						"Updated extracted question.",
					);
				})(),
				toUIMessageStream: vi.fn(() => (async function* () {})()),
			};
		});

		const pass = await runExtractionPass({
			text: "Texto da prova",
			fileName: "prova-redes.txt",
			config: {
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			agentRuns: createAgentRunsMock(),
			onWarning: vi.fn(),
			log: { error: vi.fn() },
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
		});

		const result = pass.result;

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
					yield await yieldStageStatusReport(
						options?.tools,
						"Extracted 1 question.",
					);
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
					yield await yieldStageStatusReport(
						options?.tools,
						"Extracted 2 questions.",
					);
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

	it("does not mention web_search in the extraction system prompt", async () => {
		mockStreamParts([]);

		const onWarning = vi.fn();
		const agentRuns = createAgentRunsMock();

		await expect(
			runExtractionPass({
				text: "Sem questoes",
				fileName: "exam.txt",
				config: {
					model: "openai/gpt-4o-mini",
					baseUrl: "https://openrouter.ai/api/v1",
					apiKey: "test-key",
				},
				agentRuns,
				onWarning,
				log: { error: vi.fn() },
				stageId: "initial_extraction",
				stageLabel: "Initial extraction agent",
			}),
		).rejects.toThrow();

		const pendingCall = agentRuns.lifecycle.mock.calls.find(
			(call) => call[1] === "pending",
		);
		const systemPrompt = pendingCall?.[2]?.systemPrompt as string | undefined;
		expect(systemPrompt).toBeDefined();
		expect(systemPrompt).not.toContain("web_search");
		expect(systemPrompt).not.toContain("web_fetch");
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

	it("continues after a recoverable text-part compatibility error", async () => {
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
					yield {
						type: "error",
						error: "text part dde5bf33-a114-4841-b717-7d9f17785d67 not found",
					} as TextStreamPart<ToolSet>;
					yield await yieldStageStatusReport(
						options?.tools,
						"Extracted 1 question.",
					);
				})(),
				toUIMessageStream: vi.fn(() => (async function* () {})()),
			};
		});

		const onWarning = vi.fn();
		const log = { error: vi.fn() };
		const agentRuns = createAgentRunsMock();

		const pass = await runExtractionPass({
			text: "Texto da prova",
			fileName: "exam.txt",
			config: {
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			agentRuns,
			onWarning,
			log,
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
		});

		const result = pass.result;
		expect(result.questions).toHaveLength(1);
		expect(onWarning).toHaveBeenCalledWith(
			expect.stringContaining(
				"Provider dropped a stream chunk after a tool call",
			),
		);
	});

	it("warns when the agent retries an already-registered question", async () => {
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const addQuestion = getTool(options?.tools, "add_extracted_question");
			return {
				fullStream: (async function* () {
					await addQuestion.execute(
						{
							question: "Qual e a derivada de f(x) = x²?",
							options: ["1", "2x", "x²", "2"],
							answers: ["2x"],
							scoringMode: "exact",
						},
						{ toolCallId: "tc-1" },
					);
					await addQuestion.execute(
						{
							question: "Qual e a derivada de f(x) = x²?",
							options: ["1", "2x", "x²", "2"],
							answers: ["2x"],
							scoringMode: "exact",
						},
						{ toolCallId: "tc-2" },
					);
					yield await yieldStageStatusReport(
						options?.tools,
						"Extracted 1 question.",
					);
				})(),
				toUIMessageStream: vi.fn(() => (async function* () {})()),
			};
		});

		const onWarning = vi.fn();
		const pass = await runExtractionPass({
			text: "1. Qual e a derivada de f(x) = x²?\na) 1\nb) 2x\nc) x²\nd) 2",
			fileName: "single-question.md",
			config: {
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			agentRuns: createAgentRunsMock(),
			onWarning,
			log: { error: vi.fn() },
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
		});

		const result = pass.result;
		expect(result.questions).toHaveLength(1);
		expect(onWarning).toHaveBeenCalledWith(
			"Extraction agent retried an already-registered question; stopped the tool loop and kept the workspace result.",
		);
	});

	it("emits tool-call events when arguments are complete", async () => {
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
					yield await yieldStageStatusReport(
						options?.tools,
						"Extracted 1 question.",
					);
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
			agentRuns,
			onWarning: vi.fn(),
			log: { error: vi.fn() },
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
		});

		expect(agentRuns.toolCall).toHaveBeenCalledWith(
			expect.objectContaining({ agentRunId: "initial_extraction-1" }),
			expect.objectContaining({
				name: "add_extracted_question",
				state: "input-complete",
			}),
			expect.objectContaining({ toolCallId: "tc-stream-1" }),
		);
	});

	it("does not stop before report_agent_stage_status when the target count is reached", async () => {
		streamTextMock.mockImplementation((options?: {
			tools?: ToolSet;
			stopWhen?: Array<(ctx: { steps: unknown[] }) => boolean>;
		}) => {
			const stopWhen = options?.stopWhen ?? [];
			const addStep = {
				toolResults: [
					{
						toolName: "add_extracted_question",
						output: { ok: true, questionId: "q1", totalQuestions: 1 },
					},
				],
			};

			expect(
				stopWhen.some((condition) => condition({ steps: [addStep] })),
			).toBe(false);

			const addQuestion = getTool(options?.tools, "add_extracted_question");
			return {
				fullStream: (async function* () {
					await addQuestion.execute(
						{
							question: "Qual e a derivada de f(x) = x²?",
							options: ["1", "2x"],
							answer: "2x",
							topic: "Calculo",
						},
						{ toolCallId: "tc-1" },
					);
					yield await yieldStageStatusReport(
						options?.tools,
						"Extracted 1 question.",
					);
				})(),
				toUIMessageStream: vi.fn(() => (async function* () {})()),
			};
		});

		const pass = await runExtractionPass({
			text: "1. Qual e a derivada de f(x) = x²?\na) 1\nb) 2x",
			fileName: "single-question.md",
			config: {
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			agentRuns: createAgentRunsMock(),
			onWarning: vi.fn(),
			log: { error: vi.fn() },
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
		});

		expect(pass.stageStatusMessage).toBe("Extracted 1 question.");
	});

	it("succeeds after a retry loop when the target question is already registered", async () => {
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const addQuestion = getTool(options?.tools, "add_extracted_question");
			return {
				fullStream: (async function* () {
					await addQuestion.execute(
						{
							question: "1. Qual é a derivada de f(x) = x²?",
							options: ["1", "2x", "x²", "2"],
							answers: ["2x"],
						},
						{ toolCallId: "tc-1" },
					);
					yield {
						type: "tool-result",
						toolCallId: "tc-1",
						toolName: "add_extracted_question",
						input: {
							question: "1. Qual é a derivada de f(x) = x²?",
							options: ["1", "2x", "x²", "2"],
							answers: ["2x"],
						},
						output: {
							ok: true,
							added: true,
							questionId: "q1",
							totalQuestions: 1,
						},
					} as TextStreamPart<ToolSet>;
					await addQuestion.execute(
						{
							questionText: "Qual é a derivada de f(x) = x²?",
							options: '["1", "2x", "x²", "2"]',
							answers: '["2x"]',
							topic: "Cálculo Diferencial",
						},
						{ toolCallId: "tc-2" },
					);
					yield {
						type: "tool-result",
						toolCallId: "tc-2",
						toolName: "add_extracted_question",
						input: {
							questionText: "Qual é a derivada de f(x) = x²?",
							options: '["1", "2x", "x²", "2"]',
							answers: '["2x"]',
							topic: "Cálculo Diferencial",
						},
						output: {
							ok: true,
							alreadyExists: true,
							questionId: "q1",
							totalQuestions: 1,
							message:
								"All expected source questions are already registered. Call report_agent_stage_status to finish this stage.",
						},
					} as TextStreamPart<ToolSet>;
					yield await yieldStageStatusReport(
						options?.tools,
						"Extracted 1 question about derivatives.",
						"tc-stage",
					);
				})(),
				toUIMessageStream: vi.fn(() => (async function* () {})()),
			};
		});

		const pass = await runExtractionPass({
			text: "1. Qual é a derivada de f(x) = x²?\n   a) 1\n   b) 2x\n   c) x²\n   d) 2",
			fileName: "single-question.md",
			config: {
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			agentRuns: createAgentRunsMock(),
			onWarning: vi.fn(),
			log: { error: vi.fn() },
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
		});

		expect(pass.result.questions).toHaveLength(1);
		expect(pass.stageStatus).toBe("done");
		expect(pass.stageStatusMessage).toBe(
			"Extracted 1 question about derivatives.",
		);
	});
});
