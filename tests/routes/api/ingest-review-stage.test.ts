import { beforeEach, describe, expect, it, vi } from "vitest";

const { reviewExtractionMock } = vi.hoisted(() => ({
	reviewExtractionMock: vi.fn(),
}));

vi.mock("@/features/ai/agents/ingest/review-extraction", () => ({
	reviewExtraction: reviewExtractionMock,
}));

import { runReviewStage } from "@/routes/api/ingest/-review-stage";

function createAgentRunsMock() {
	return {
		createRun: vi.fn((stageId: string, label: string) => ({
			stageId,
			agentRunId: `${stageId}-1`,
			label,
		})),
		lifecycle: vi.fn(),
		warning: vi.fn(),
		result: vi.fn(),
		token: vi.fn(),
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

		const send = vi.fn();
		const agentRuns = createAgentRunsMock();

		await runReviewStage({
			enableReview: true,
			config: {
				provider: "openrouter",
				model: "openai/gpt-4o-mini",
				apiKey: "test-key",
			},
			text: "Texto original",
			extracted: {
				questions: [
					{
						question: "Pergunta",
						options: ["A", "B"],
						answer: "A",
						explanation: "",
						topic: "Geral",
					},
				],
				topics: ["Geral"],
			},
			criticalTopics: [],
			agentRuns,
			send,
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
		expect(send).toHaveBeenCalledWith("warning", {
			message:
				"Review failed for question #1. Keeping the original extracted question.",
			stageId: "review",
			agentRunId: "review-1",
		});
	});
});
