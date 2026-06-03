import { beforeEach, describe, expect, it, vi } from "vitest";
import type { generateJson } from "@/features/ai/core/generate";

const { generateJsonMock } = vi.hoisted(() => ({
	generateJsonMock: vi.fn(),
}));

vi.mock("@/features/ai/core/generate", () => ({
	generateJson: generateJsonMock,
}));

import { runBatchQuestionExplanations } from "@/features/ai/agents/explanations";

describe("runBatchQuestionExplanations", () => {
	beforeEach(() => {
		generateJsonMock.mockReset();
	});

	it("emits lifecycle and result events around a batch run", async () => {
		generateJsonMock.mockResolvedValue({
			questions: [
				{
					id: 10,
					explanation: "Explicacao curta",
					deepExplanation: "Explicacao longa",
				},
			],
		});

		const onAgentEvent = vi.fn();

		const result = await runBatchQuestionExplanations(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
			},
			[
				{
					id: 10,
					question: "O que e escalonamento?",
					options: ["A", "B"],
					answer: "A",
					topic: "SO",
				},
			],
			{
				memoryContext: "Aluno prefere exemplos curtos",
				onAgentEvent,
				createAgentRunId: (label) => `run:${label}`,
			},
		);

		expect(result.questions).toEqual([
			{
				id: 10,
				explanation: "Explicacao curta",
				deepExplanation: "Explicacao longa",
			},
		]);
		expect(result.agentRuns).toHaveLength(1);
		expect(result.agentRuns[0]).toMatchObject({
			agentRunId: "run:Explanation batch 1",
			label: "Explanation batch 1",
			status: "done",
			finalObject: {
				questions: [
					{
						id: 10,
						explanation: "Explicacao curta",
						deepExplanation: "Explicacao longa",
					},
				],
			},
		});
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				eventType: "lifecycle",
				status: "pending",
				agentRunId: "run:Explanation batch 1",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				eventType: "lifecycle",
				status: "running",
				agentRunId: "run:Explanation batch 1",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({
				eventType: "result",
				agentRunId: "run:Explanation batch 1",
			}),
		);
		expect(onAgentEvent).toHaveBeenNthCalledWith(
			4,
			expect.objectContaining({
				eventType: "lifecycle",
				status: "done",
				agentRunId: "run:Explanation batch 1",
			}),
		);
	});

	it("passes tools and system prompt through generateJson", async () => {
		generateJsonMock.mockResolvedValue({
			questions: [
				{
					id: 11,
					explanation: "Curta",
					deepExplanation: "Longa",
				},
			],
		});

		const tools = [
			{
				description: "Busca",
				parameters: {},
				execute: vi.fn(),
			},
		] as unknown as NonNullable<Parameters<typeof generateJson>[3]>["tools"];

		await runBatchQuestionExplanations(
			{
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
			},
			[
				{
					id: 11,
					question: "Pergunta",
					options: ["A", "B"],
					answer: "A",
				},
			],
			{
				memoryContext: "contexto",
				tools,
			},
		);

		expect(generateJsonMock).toHaveBeenCalledWith(
			expect.anything(),
			expect.stringContaining("Generate explanation and deepExplanation"),
			expect.anything(),
			expect.objectContaining({
				system: expect.stringContaining(
					"Use this student memory context to adapt teaching style and emphasis.",
				),
				tools,
			}),
		);
	});
});
