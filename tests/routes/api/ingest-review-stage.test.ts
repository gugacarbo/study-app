import { beforeEach, describe, expect, it, vi } from "vitest";

const { reviewExtractionMock } = vi.hoisted(() => ({
	reviewExtractionMock: vi.fn(),
}));

vi.mock("@/features/ai/agents/ingest/review-extraction", () => ({
	reviewExtraction: reviewExtractionMock,
}));

import { runReviewStage } from "@/routes/api/ingest/-review-stage";

function createAgentRunsMock() {
	let counter = 0;
	return {
		allocateAgentRunId: vi.fn((stageId: string) => {
			counter += 1;
			return `${stageId}-${counter}`;
		}),
		createRun: vi.fn((stageId: string, label: string) => ({
			stageId,
			agentRunId: `${stageId}-1`,
			label,
		})),
		lifecycle: vi.fn(),
		warning: vi.fn(),
		result: vi.fn(),
		token: vi.fn(),
		textDelta: vi.fn(),
		reasoningDelta: vi.fn(),
		toolCall: vi.fn(),
		toolResult: vi.fn(),
	};
}

describe("runReviewStage", () => {
	beforeEach(() => {
		reviewExtractionMock.mockReset();
	});

	it("forwards reviewer agent warnings as SSE warning events", async () => {
		reviewExtractionMock.mockImplementation(
			async (
				_config: unknown,
				_text: string,
				extracted: { questions: unknown[]; topics: string[] },
				options?: {
					onAgentEvent?: (event: Record<string, unknown>) => void;
				},
			) => {
				options?.onAgentEvent?.({
					eventType: "warning",
					stageId: "review",
					agentRunId: "review-1",
					label: "Reviewer Q1",
					warning:
						"Review failed for question #1. Keeping the original extracted question.",
					meta: { questionIndex: 0, questionNumber: 1 },
				});

				return {
					extracted,
					reviewed: true,
					reviewedQuestionCount: 0,
					failedQuestionCount: 1,
					reasons: ["tool failed"],
				};
			},
		);

		const writer = { write: vi.fn() };
		const onProgress = vi.fn();
		const onWarning = vi.fn();
		const agentRuns = createAgentRunsMock();

		await runReviewStage({
			enableReview: true,
			agentConcurrency: 10,
			config: {
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			text: "Texto original",
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
			criticalTopics: [],
			agentRuns,
			writer: writer as never,
			onProgress,
			onWarning,
			log: { error: vi.fn() },
		});

		expect(agentRuns.warning).toHaveBeenCalledWith(
			expect.objectContaining({
				agentRunId: "review-1",
				stageId: "review",
				label: "Reviewer Q1",
			}),
			"Review failed for question #1. Keeping the original extracted question.",
			{ questionIndex: 0, questionNumber: 1 },
		);
		expect(onWarning).toHaveBeenCalledWith(
			"Review failed for question #1. Keeping the original extracted question.",
			{
				stageId: "review",
				agentRunId: "review-1",
			},
		);
	});

	it("bridges text-delta token events to agentRuns.textDelta", async () => {
		reviewExtractionMock.mockImplementation(
			async (
				_config: unknown,
				_text: string,
				extracted: { questions: unknown[]; topics: string[] },
				options?: {
					onAgentEvent?: (event: Record<string, unknown>) => void;
				},
			) => {
				options?.onAgentEvent?.({
					eventType: "token",
					stageId: "review",
					agentRunId: "review-1",
					label: "Reviewer Q1",
					rawText: "Reviewing wording...",
					meta: { questionIndex: 0, questionNumber: 1 },
				});

				return {
					extracted,
					reviewed: true,
					reviewedQuestionCount: 1,
					failedQuestionCount: 0,
					reasons: [],
				};
			},
		);

		const writer = { write: vi.fn() };
		const agentRuns = createAgentRunsMock();

		await runReviewStage({
			enableReview: true,
			agentConcurrency: 10,
			config: {
				model: "openai/gpt-4o-mini",
				baseUrl: "https://openrouter.ai/api/v1",
				apiKey: "test-key",
			},
			text: "Texto original",
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
			criticalTopics: [],
			agentRuns,
			writer: writer as never,
			onProgress: vi.fn(),
			onWarning: vi.fn(),
			log: { error: vi.fn() },
		});

		expect(agentRuns.textDelta).toHaveBeenCalledWith(
			expect.objectContaining({
				agentRunId: "review-1",
				stageId: "review",
				label: "Reviewer Q1",
			}),
			"Reviewing wording...",
		);
	});
});
