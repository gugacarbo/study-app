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

import { runExtractionPass } from "@/routes/api/ingest/-extraction-pass";

type Tool = {
	name: string;
	execute: (input: Record<string, unknown>) => Promise<unknown>;
};

function getTool(tools: readonly unknown[] | undefined, name: string): Tool {
	const tool = tools?.find((candidate) => (candidate as Tool).name === name);
	if (!tool) throw new Error(`Tool ${name} not found`);
	return tool as Tool;
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
		toolCall: vi.fn(),
		toolResult: vi.fn(),
	};
}

describe("runExtractionPass", () => {
	beforeEach(() => {
		streamChatMessagesMock.mockReset();
	});

	it("builds the final ingest result from tool calls", async () => {
		streamChatMessagesMock.mockImplementation(
			(
				_config: unknown,
				_messages: unknown,
				options?: { tools?: readonly unknown[] },
			) =>
				(async function* () {
					const addQuestion = getTool(
						options?.tools,
						"add_extracted_question",
					);
					await addQuestion.execute({
						question: "O que e cache?",
						options: ["Memoria rapida", "Disco rigido"],
						answer: "Memoria rapida",
						topic: "Memoria",
					});
					yield {
						type: "TOOL_CALL_END",
						toolCallId: "tc-1",
						toolCallName: "add_extracted_question",
						input: {
							question: "O que e cache?",
							options: ["Memoria rapida", "Disco rigido"],
							answer: "Memoria rapida",
							topic: "Memoria",
						},
						result: '{"ok":true}',
					};
					yield {
						type: "RUN_FINISHED",
						threadId: "thread-1",
						runId: "run-1",
						finishReason: "stop",
						usage: {
							promptTokens: 10,
							completionTokens: 5,
							totalTokens: 15,
						},
					};
				})(),
		);

		const send = vi.fn();
		const agentRuns = createAgentRunsMock();
		const log = { error: vi.fn() };

		const result = await runExtractionPass({
			text: "Texto da prova",
			config: {
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
			},
			criticalTopics: [],
			agentRuns,
			send,
			log,
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
		});

		expect(result).toEqual({
			questions: [
				{
					question: "O que e cache?",
					options: ["Memoria rapida", "Disco rigido"],
					answer: "Memoria rapida",
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
			{
				content: '{"ok":true}',
				error: undefined,
				state: "complete",
			},
			{ toolCallId: "tc-1" },
		);
	});

	it("supports add followed by update on the same question", async () => {
		streamChatMessagesMock.mockImplementation(
			(
				_config: unknown,
				_messages: unknown,
				options?: { tools?: readonly unknown[] },
			) =>
				(async function* () {
					const addQuestion = getTool(
						options?.tools,
						"add_extracted_question",
					);
					const updateQuestion = getTool(
						options?.tools,
						"update_extracted_question",
					);
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
					yield {
						type: "RUN_FINISHED",
						threadId: "thread-1",
						runId: "run-1",
						finishReason: "stop",
					};
				})(),
		);

		const result = await runExtractionPass({
			text: "Texto da prova",
			config: {
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
			},
			criticalTopics: [],
			agentRuns: createAgentRunsMock(),
			send: vi.fn(),
			log: { error: vi.fn() },
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
		});

		expect(result).toEqual({
			questions: [
				{
					question: "Questao corrigida",
					options: ["A", "B"],
					answer: "A",
					deepExplanation: undefined,
					explanation: "",
					topic: "Topico 2",
				},
			],
			topics: ["Topico 2"],
		});
	});

	it("deduplicates repeated tool transcript lines for the same toolCallId", async () => {
		streamChatMessagesMock.mockImplementation(
			(
				_config: unknown,
				_messages: unknown,
				options?: { tools?: readonly unknown[] },
			) =>
				(async function* () {
					const addQuestion = getTool(
						options?.tools,
						"add_extracted_question",
					);
					await addQuestion.execute({
						question: "Questao unica",
						options: ["A", "B"],
						answer: "A",
						topic: "Geral",
					});
					yield {
						type: "TOOL_CALL_END",
						toolCallId: "tc-dedupe-1",
						toolCallName: "add_extracted_question",
						input: {
							question: "Questao unica",
							options: ["A", "B"],
							answer: "A",
							topic: "Geral",
						},
						result: '{"ok":false,"error":{"message":"retry"}}',
					};
					yield {
						type: "TOOL_CALL_END",
						toolCallId: "tc-dedupe-1",
						toolCallName: "add_extracted_question",
						input: {
							question: "Questao unica",
							options: ["A", "B"],
							answer: "A",
							topic: "Geral",
						},
						result: '{"ok":true,"questionId":"q1"}',
					};
					yield {
						type: "RUN_FINISHED",
						threadId: "thread-1",
						runId: "run-1",
						finishReason: "stop",
					};
				})(),
		);

		const agentRuns = createAgentRunsMock();

		await runExtractionPass({
			text: "Texto da prova",
			config: {
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
			},
			criticalTopics: [],
			agentRuns,
			send: vi.fn(),
			log: { error: vi.fn() },
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
		});

		const rawText = agentRuns.result.mock.calls[0]?.[2];
		const toolMatches = String(rawText).match(/\[tool:add_extracted_question\]/g) ?? [];

		expect(toolMatches).toHaveLength(1);
	});

	it("throws and warns when no question is added", async () => {
		streamChatMessagesMock.mockImplementation(
			() =>
				(async function* () {
					yield {
						type: "RUN_FINISHED",
						threadId: "thread-1",
						runId: "run-1",
						finishReason: "stop",
					};
				})(),
		);

		const send = vi.fn();

		await expect(
			runExtractionPass({
				text: "Sem questoes",
				config: {
					provider: "openrouter",
					model: "openai/gpt-4o-mini",
					apiKey: "test-key",
				},
				criticalTopics: [],
				agentRuns: createAgentRunsMock(),
				send,
				log: { error: vi.fn() },
				stageId: "initial_extraction",
				stageLabel: "Initial extraction agent",
			}),
		).rejects.toThrow(
			"No questions were extracted during the initial ingest pass.",
		);
		expect(send).toHaveBeenCalledWith("warning", {
			message: "No questions were extracted during the initial ingest pass.",
		});
	});

	it("emits incremental tool-call events while arguments stream", async () => {
		streamChatMessagesMock.mockImplementation(
			(
				_config: unknown,
				_messages: unknown,
				options?: { tools?: readonly unknown[] },
			) =>
				(async function* () {
					const addQuestion = getTool(
						options?.tools,
						"add_extracted_question",
					);
					yield {
						type: "TOOL_CALL_START",
						toolCallId: "tc-stream-1",
						toolCallName: "add_extracted_question",
					};
					yield {
						type: "TOOL_CALL_ARGS",
						toolCallId: "tc-stream-1",
						delta: '{"question":"Qual e a derivada?"',
					};
					yield {
						type: "TOOL_CALL_ARGS",
						toolCallId: "tc-stream-1",
						delta: ',"answer":"2x"}',
					};
					await addQuestion.execute({
						question: "Qual e a derivada?",
						answer: "2x",
						options: ["1", "2x"],
						topic: "Calculo",
					});
					yield {
						type: "TOOL_CALL_END",
						toolCallId: "tc-stream-1",
						toolCallName: "add_extracted_question",
						input: {
							question: "Qual e a derivada?",
							answer: "2x",
							options: ["1", "2x"],
							topic: "Calculo",
						},
						result: { ok: true, questionId: "q1" },
					};
					yield {
						type: "RUN_FINISHED",
						threadId: "thread-1",
						runId: "run-1",
						finishReason: "stop",
					};
				})(),
		);

		const agentRuns = createAgentRunsMock();
		await runExtractionPass({
			text: "Texto da prova",
			config: {
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
			},
			criticalTopics: [],
			agentRuns,
			send: vi.fn(),
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
