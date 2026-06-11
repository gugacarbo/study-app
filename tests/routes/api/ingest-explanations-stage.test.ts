import { beforeEach, describe, expect, it, vi } from "vitest";

const { runQuestionExplanationsMock } = vi.hoisted(() => ({
	runQuestionExplanationsMock: vi.fn(),
}));

vi.mock("@/features/ai/agents/explanations", () => ({
	runQuestionExplanations: runQuestionExplanationsMock,
}));

import { runExplanationsStage } from "@/routes/api/ingest/-explanations-stage";

function createAgentRunsMock() {
	return {
		createRun: vi.fn((stageId: string, label: string) => ({
			stageId,
			agentRunId: `${stageId}-${label}`,
			label,
		})),
		lifecycle: vi.fn(),
		result: vi.fn(),
		warning: vi.fn(),
		token: vi.fn(),
		toolCall: vi.fn(),
		toolResult: vi.fn(),
	};
}

function createMemoryMock() {
	return {
		buildMemoryPrompt: vi.fn().mockResolvedValue("memory context"),
	};
}

describe("runExplanationsStage", () => {
	beforeEach(() => {
		runQuestionExplanationsMock.mockReset();
	});

	it("skips explanation generation when disabled", async () => {
		const writer = { write: vi.fn() };
		const onProgress = vi.fn();
		const onWarning = vi.fn();
		const agentRuns = createAgentRunsMock();

		const result = await runExplanationsStage({
			enableExplanations: false,
			agentConcurrency: 10,
			config: {
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			extracted: {
				questions: [
					{
						question: "Pergunta",
						options: ["A", "B"],
						answers: ["A"],
						scoringMode: "exact" as const,
						explanation: "",
						topic: "Geral",
					},
				],
				topics: ["Geral"],
			},
			memory: createMemoryMock() as never,
			agentRuns,
			writer: writer as never,
			onProgress,
			onWarning,
			log: { error: vi.fn() },
		});

		expect(result).toBeNull();
		expect(runQuestionExplanationsMock).not.toHaveBeenCalled();
		expect(writer.write).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "data-stage",
				data: expect.objectContaining({
					stageId: "explanations",
					status: "skipped",
				}),
			}),
		);
	});

	it("runs one explanation agent per question and merges results", async () => {
		runQuestionExplanationsMock.mockResolvedValue({
			questions: [
				{
					id: 1,
					explanation: "Curta",
					deepExplanation: "Longa",
				},
			],
			agentRuns: [],
			generatedQuestionCount: 1,
			failedQuestionCount: 0,
			reasons: [],
		});

		const writer = { write: vi.fn() };
		const onProgress = vi.fn();
		const onWarning = vi.fn();
		const agentRuns = createAgentRunsMock();
		const memory = createMemoryMock();

		const result = await runExplanationsStage({
			enableExplanations: true,
			agentConcurrency: 10,
			config: {
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			extracted: {
				questions: [
					{
						question: "Pergunta",
						options: ["A", "B"],
						answers: ["A"],
						scoringMode: "exact" as const,
						explanation: "",
						topic: "Geral",
					},
				],
				topics: ["Geral"],
			},
			memory: memory as never,
			agentRuns,
			writer: writer as never,
			onProgress,
			onWarning,
			log: { error: vi.fn() },
		});

		expect(memory.buildMemoryPrompt).toHaveBeenCalledWith(["Geral"]);
		expect(runQuestionExplanationsMock).toHaveBeenCalledWith(
			expect.anything(),
			[
				expect.objectContaining({
					id: 1,
					question: "Pergunta",
				}),
			],
			expect.objectContaining({
				resolveMemoryContext: expect.any(Function),
			}),
		);
		expect(result).toEqual({
			questions: [
				{
					question: "Pergunta",
					options: ["A", "B"],
					answers: ["A"],
					scoringMode: "exact",
					explanation: "Curta",
					deepExplanation: "Longa",
					topic: "Geral",
				},
			],
			topics: ["Geral"],
		});
		expect(writer.write).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "data-stage",
				data: expect.objectContaining({
					stageId: "explanations",
					status: "done",
				}),
			}),
		);
	});
});
