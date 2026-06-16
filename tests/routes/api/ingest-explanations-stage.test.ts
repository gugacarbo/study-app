import { beforeEach, describe, expect, it, vi } from "vitest";

const { explainSingleQuestionMock } = vi.hoisted(() => ({
	explainSingleQuestionMock: vi.fn(),
}));

vi.mock(
	"@/features/ai/agents/explanations/generate-explanations/explain-single-question",
	() => ({
		explainSingleQuestion: explainSingleQuestionMock,
	}),
);

import { runExplanationsStage } from "@/routes/api/ingest/-explanations-stage";

function createAgentRunsMock() {
	let counter = 0;
	return {
		allocateAgentRunId: vi.fn((stageId: string) => {
			counter += 1;
			return `${stageId}-${counter}`;
		}),
		createRun: vi.fn((stageId: string, label: string) => ({
			stageId,
			agentRunId: `${stageId}-${label}`,
			label,
		})),
		lifecycle: vi.fn(),
		result: vi.fn(),
		warning: vi.fn(),
		token: vi.fn(),
		textDelta: vi.fn(),
		reasoningDelta: vi.fn(),
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
		explainSingleQuestionMock.mockReset();
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
				examName: "exam",
				topics: ["Geral"],
			},
			memory: createMemoryMock() as never,
			agentRuns,
			writer: writer as never,
			onProgress,
			onWarning,
		});

		expect(result).toBeNull();
		expect(explainSingleQuestionMock).not.toHaveBeenCalled();
		expect(agentRuns.warning).toHaveBeenCalledWith(
			expect.objectContaining({
				stageId: "explanations",
				label: "Explanation generation disabled",
			}),
			"Explanation generation disabled for this ingest.",
			{ disabled: true },
		);
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
		explainSingleQuestionMock.mockResolvedValue({
			result: {
				id: 1,
				explanation: "Curta",
				deepExplanation: "Longa",
			},
			success: true,
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
				examName: "exam",
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
		});

		expect(memory.buildMemoryPrompt).toHaveBeenCalledWith(["Geral"]);
		expect(explainSingleQuestionMock).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				id: 1,
				question: "Pergunta",
			}),
			0,
			1,
			expect.objectContaining({
				resolveMemoryContext: expect.any(Function),
			}),
		);
		expect(result).toEqual({
			examName: "exam",
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
