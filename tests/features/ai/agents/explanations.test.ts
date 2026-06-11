import type { ToolSet } from "ai";
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
	streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
		const updateExplanation = getTool(
			options?.tools,
			"update_question_explanation",
		);
		return {
			fullStream: (async function* () {
				await updateExplanation.execute({
					questionId,
					explanation: `Curta ${questionId}`,
					deepExplanation: `Longa ${questionId}`,
				});
			})(),
		};
	});
}

describe("explainSingleQuestion", () => {
	beforeEach(() => {
		streamTextMock.mockReset();
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

	it("passes explanation tools and memory context through streamText", async () => {
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

		expect(streamTextMock).toHaveBeenCalledWith(
			expect.objectContaining({
				system: expect.stringContaining(
					"Use this student memory context to adapt teaching style and emphasis.",
				),
				messages: [
					expect.objectContaining({
						role: "user",
						content: expect.stringContaining("question #1"),
					}),
				],
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

		expect(streamTextMock).toHaveBeenCalledWith(
			expect.objectContaining({
				system: expect.stringContaining("contexto de SO"),
			}),
		);
		expect(streamTextMock).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					expect.objectContaining({
						role: "user",
						content: expect.not.stringContaining('"options"'),
					}),
				],
			}),
		);
	});
});

describe("runQuestionExplanations", () => {
	beforeEach(() => {
		streamTextMock.mockReset();
	});

	it("runs one agent per question and aggregates the results", async () => {
		let callCount = 0;
		streamTextMock.mockImplementation((options?: { tools?: ToolSet }) => {
			const updateExplanation = getTool(
				options?.tools,
				"update_question_explanation",
			);
			callCount += 1;
			const questionId = callCount === 1 ? 1 : 2;
			return {
				fullStream: (async function* () {
					await updateExplanation.execute({
						questionId,
						explanation: `Curta ${questionId}`,
						deepExplanation: `Longa ${questionId}`,
					});
				})(),
			};
		});

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

		expect(streamTextMock).toHaveBeenCalledTimes(2);
		expect(result.questions).toEqual([
			{ id: 1, explanation: "Curta 1", deepExplanation: "Longa 1" },
			{ id: 2, explanation: "Curta 2", deepExplanation: "Longa 2" },
		]);
		expect(result.agentRuns).toHaveLength(2);
		expect(result.generatedQuestionCount).toBe(2);
		expect(result.failedQuestionCount).toBe(0);
	});
});
