import type { ToolSet } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { streamChatMessagesMock } = vi.hoisted(() => ({
	streamChatMessagesMock: vi.fn(),
}));

vi.mock("@/features/ai/core/chat-stream", () => ({
	streamChatMessages: streamChatMessagesMock,
}));

import {
	explainSingleQuestion,
	runQuestionExplanations,
} from "@/features/ai/agents/explanations";

type ExecutableTool = {
	execute: (input: Record<string, unknown>) => Promise<unknown>;
};

function getTool(tools: ToolSet | undefined, name: string): ExecutableTool {
	const tool = tools?.[name] as ExecutableTool | undefined;
	if (!tool?.execute) throw new Error(`Tool ${name} not found`);
	return tool;
}

function mockSuccessfulExplanationRun(questionId: number) {
	streamChatMessagesMock.mockImplementation(
		(
			_config: unknown,
			_messages: unknown,
			options?: { tools?: ToolSet },
		) =>
			(async function* () {
				const updateExplanation = getTool(
					options?.tools,
					"update_question_explanation",
				);
				await updateExplanation.execute({
					questionId,
					explanation: `Curta ${questionId}`,
					deepExplanation: `Longa ${questionId}`,
				});
				yield {
					type: "RUN_FINISHED",
					threadId: "thread-1",
					runId: "run-1",
					finishReason: "stop",
				};
			})(),
	);
}

describe("explainSingleQuestion", () => {
	beforeEach(() => {
		streamChatMessagesMock.mockReset();
	});

	it("emits lifecycle and result events for a single-question explanation run", async () => {
		mockSuccessfulExplanationRun(10);

		const onAgentEvent = vi.fn();

		const result = await explainSingleQuestion(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			{
				id: 10,
				question: "O que e escalonamento?",
				options: ["A", "B"],
				answers: ["A"],
				topic: "SO",
			},
			0,
			1,
			{
				memoryContext: "Aluno prefere exemplos curtos",
				onAgentEvent,
				createAgentRunId: (label) => `run:${label}`,
			},
		);

		expect(result).toEqual({
			success: true,
			result: {
				id: 10,
				explanation: "Curta 10",
				deepExplanation: "Longa 10",
			},
		});
		expect(onAgentEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: "lifecycle",
				status: "pending",
				agentRunId: "run:Explanation Q1",
				label: "Explanation Q1",
			}),
		);
		expect(onAgentEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: "result",
				agentRunId: "run:Explanation Q1",
				finalObject: {
					id: 10,
					explanation: "Curta 10",
					deepExplanation: "Longa 10",
				},
			}),
		);
	});

	it("passes explanation tools and memory context through streamChatMessages", async () => {
		mockSuccessfulExplanationRun(11);

		await explainSingleQuestion(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			{
				id: 11,
				question: "Pergunta",
				options: ["A", "B"],
				answers: ["A"],
			},
			0,
			1,
			{
				memoryContext: "contexto",
			},
		);

		expect(streamChatMessagesMock).toHaveBeenCalledWith(
			expect.anything(),
			expect.arrayContaining([
				expect.objectContaining({
					role: "user",
					content: expect.stringContaining("question #1"),
				}),
			]),
			expect.objectContaining({
				system: expect.stringContaining(
					"Use this student memory context to adapt teaching style and emphasis.",
				),
				tools: expect.objectContaining({
					update_question_explanation: expect.objectContaining({
						execute: expect.any(Function),
					}),
					list_explanation_questions: expect.objectContaining({
						execute: expect.any(Function),
					}),
				}),
			}),
		);
	});

	it("uses resolveMemoryContext for the current question only", async () => {
		mockSuccessfulExplanationRun(12);

		await explainSingleQuestion(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			{
				id: 12,
				question: "Pergunta de SO",
				options: ["A", "B"],
				answers: ["A"],
				topic: "SO",
			},
			0,
			1,
			{
				memoryContext: "contexto global",
				resolveMemoryContext: (question) =>
					question.topic === "SO" ? "contexto de SO" : undefined,
			},
		);

		expect(streamChatMessagesMock).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({
				system: expect.stringContaining("contexto de SO"),
			}),
		);
		expect(streamChatMessagesMock).toHaveBeenCalledWith(
			expect.anything(),
			[
				expect.objectContaining({
					role: "user",
					content: expect.not.stringContaining('"options"'),
				}),
			],
			expect.anything(),
		);
	});
});

describe("runQuestionExplanations", () => {
	beforeEach(() => {
		streamChatMessagesMock.mockReset();
	});

	it("runs one agent per question and aggregates the results", async () => {
		let callCount = 0;
		streamChatMessagesMock.mockImplementation(
			(
				_config: unknown,
				_messages: unknown,
				options?: { tools?: ToolSet },
			) =>
				(async function* () {
					callCount += 1;
					const questionId = callCount === 1 ? 1 : 2;
					const updateExplanation = getTool(
						options?.tools,
						"update_question_explanation",
					);
					await updateExplanation.execute({
						questionId,
						explanation: `Curta ${questionId}`,
						deepExplanation: `Longa ${questionId}`,
					});
					yield {
						type: "RUN_FINISHED",
						threadId: "thread-1",
						runId: "run-1",
						finishReason: "stop",
					};
				})(),
		);

		const result = await runQuestionExplanations(
			{
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			[
				{
					id: 1,
					question: "Pergunta 1",
					options: ["A", "B"],
					answers: ["A"],
				},
				{
					id: 2,
					question: "Pergunta 2",
					options: ["A", "B"],
					answers: ["B"],
				},
			],
		);

		expect(streamChatMessagesMock).toHaveBeenCalledTimes(2);
		expect(result.questions).toEqual([
			{ id: 1, explanation: "Curta 1", deepExplanation: "Longa 1" },
			{ id: 2, explanation: "Curta 2", deepExplanation: "Longa 2" },
		]);
		expect(result.agentRuns).toHaveLength(2);
		expect(result.generatedQuestionCount).toBe(2);
		expect(result.failedQuestionCount).toBe(0);
	});
});
