import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolSet } from "ai";

const { reviewSingleQuestionMock } = vi.hoisted(() => ({
	reviewSingleQuestionMock: vi.fn(),
}));

vi.mock(
	"@/features/ai/agents/ingest/review-extraction/review-question",
	() => ({
		reviewSingleQuestion: reviewSingleQuestionMock,
	}),
);

import {
	MAX_REVIEW_ATTEMPTS,
	REVIEW_CONCURRENCY,
	reviewExtraction,
} from "@/features/ai/agents/ingest/review-extraction/execute";

const config = {
	model: "openai/gpt-4o-mini",
	baseUrl: "https://openrouter.ai/api/v1",
	apiKey: "test-key",
};

function makeQuestion(index: number) {
	return {
		question: `Question ${index + 1}`,
		options: ["A", "B"],
		answers: ["A"],
		scoringMode: "exact" as const,
		explanation: "",
		topic: "General",
	};
}

function successResult(index: number) {
	return {
		question: makeQuestion(index),
		success: true as const,
	};
}

function failureResult(index: number, reason = "review failed") {
	return {
		question: makeQuestion(index),
		success: false as const,
		reason,
	};
}

describe("reviewExtraction", () => {
	beforeEach(() => {
		reviewSingleQuestionMock.mockReset();
	});

	it("passes each extracted question to its own reviewer by index", async () => {
		const questions = [makeQuestion(0), makeQuestion(1), makeQuestion(2)];
		const receivedQuestions: string[] = [];

		reviewSingleQuestionMock.mockImplementation(
			async (_config, _text, question, index) => {
				receivedQuestions[index] = question.question;
				return successResult(index);
			},
		);

		await reviewExtraction(
			config,
			"source text",
			{ examName: "General Exam", questions, topics: ["General"] },
			{ reviewTopics: ["General"] },
		);

		expect(receivedQuestions).toEqual([
			"Question 1",
			"Question 2",
			"Question 3",
		]);
	});

	it("aborts without retries when every reviewer fails on the first cycle", async () => {
		reviewSingleQuestionMock.mockImplementation(async (_config, _text, _question, index) =>
			failureResult(index),
		);

		await expect(
			reviewExtraction(
				config,
				"source text",
				{
					examName: "General Exam",
					questions: [makeQuestion(0), makeQuestion(1)],
					topics: ["General"],
				},
				{ reviewTopics: ["General"] },
			),
		).rejects.toThrow(
			"All 2 reviewers failed on the first cycle. Aborting review.",
		);

		expect(reviewSingleQuestionMock).toHaveBeenCalledTimes(2);
	});

	it("retries failed reviews up to MAX_REVIEW_ATTEMPTS when the first cycle is not all failures", async () => {
		const attemptsByIndex = new Map<number, number>();

		reviewSingleQuestionMock.mockImplementation(async (_config, _text, _question, index) => {
			const attempt = (attemptsByIndex.get(index) ?? 0) + 1;
			attemptsByIndex.set(index, attempt);

			if (index === 0) {
				return attempt < 3 ? failureResult(index) : successResult(index);
			}

			return successResult(index);
		});

		const onEvent = vi.fn();
		const result = await reviewExtraction(
			config,
			"source text",
			{
				examName: "General Exam",
				questions: [makeQuestion(0), makeQuestion(1)],
				topics: ["General"],
			},
			{ reviewTopics: ["General"], onEvent },
		);

		expect(result.reviewedQuestionCount).toBe(2);
		expect(result.failedQuestionCount).toBe(0);
		expect(attemptsByIndex.get(0)).toBe(3);
		expect(attemptsByIndex.get(1)).toBe(1);
		expect(onEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "step",
				message: "Retrying 1 failed review (attempt 2/3)...",
			}),
		);
		expect(onEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "step",
				message: "Retrying 1 failed review (attempt 3/3)...",
			}),
		);
	});

	it("keeps original questions when retries are exhausted", async () => {
		reviewSingleQuestionMock.mockImplementation(async (_config, _text, _question, index) =>
			index === 0 ? failureResult(index) : successResult(index),
		);

		const result = await reviewExtraction(
			config,
			"source text",
			{
				examName: "General Exam",
				questions: [makeQuestion(0), makeQuestion(1)],
				topics: ["General"],
			},
			{ reviewTopics: ["General"] },
		);

		expect(result.reviewedQuestionCount).toBe(1);
		expect(result.failedQuestionCount).toBe(1);
		expect(reviewSingleQuestionMock).toHaveBeenCalledTimes(1 + MAX_REVIEW_ATTEMPTS);
	});

	it("reuses the same agentRunId across review retries", async () => {
		const agentRunIds: string[] = [];

		reviewSingleQuestionMock.mockImplementation(
			async (_config, _text, _question, index, _total, options) => {
				const label = `Reviewer Q${index + 1}`;
				const id =
					options.createAgentRunId?.(label) ?? `review-question-${index + 1}`;
				agentRunIds.push(id);
				return index === 0 && agentRunIds.filter((value) => value === id).length < 3
					? failureResult(index)
					: successResult(index);
			},
		);

		await reviewExtraction(
			config,
			"source text",
			{
				examName: "General Exam",
				questions: [makeQuestion(0), makeQuestion(1)],
				topics: ["General"],
			},
			{
				reviewTopics: ["General"],
				createAgentRunId: (label) => `stable-${label}`,
			},
		);

		expect(
			new Set(agentRunIds.filter((id) => id.startsWith("stable-Reviewer Q1"))),
		).toEqual(new Set(["stable-Reviewer Q1"]));
		expect(agentRunIds.filter((id) => id === "stable-Reviewer Q1")).toHaveLength(3);
	});

	it("warns when web tools are an empty ToolSet object", async () => {
		const onEvent = vi.fn();

		reviewSingleQuestionMock.mockResolvedValue(successResult(0));

		await reviewExtraction(
			config,
			"source text",
			{
				examName: "General Exam",
				questions: [makeQuestion(0)],
				topics: ["General"],
			},
			{
				reviewTopics: ["General"],
				tools: {},
				onEvent,
			},
		);

		expect(onEvent).toHaveBeenCalledWith({
			type: "warning",
			message:
				"Web verification tools are unavailable. Continuing with LLM-only review (no web search/fetch).",
		});
	});

	it("does not warn about web tools when ToolSet has entries", async () => {
		const onEvent = vi.fn();

		reviewSingleQuestionMock.mockResolvedValue(successResult(0));

		await reviewExtraction(
			config,
			"source text",
			{
				examName: "General Exam",
				questions: [makeQuestion(0)],
				topics: ["General"],
			},
			{
				reviewTopics: ["General"],
				tools: { search_web: { execute: async () => ({}) } } as unknown as ToolSet,
				onEvent,
			},
		);

		expect(onEvent).not.toHaveBeenCalledWith(
			expect.objectContaining({
				type: "warning",
				message: expect.stringContaining("Web verification tools are unavailable"),
			}),
		);
	});

	it("forwards text-delta token events through onAgentEvent", async () => {
		const onAgentEvent = vi.fn();

		reviewSingleQuestionMock.mockImplementation(
			async (_config, _text, _question, index, _total, options) => {
				options.onAgentEvent?.({
					eventType: "token",
					stageId: "review",
					agentRunId: "review-q1",
					label: "Reviewer Q1",
					rawText: "Checking extracted question...",
					meta: { questionIndex: index, questionNumber: index + 1 },
				});
				return successResult(index);
			},
		);

		await reviewExtraction(
			config,
			"source text",
			{
				examName: "General Exam",
				questions: [makeQuestion(0)],
				topics: ["General"],
			},
			{ reviewTopics: ["General"], onAgentEvent },
		);

		expect(onAgentEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: "token",
				rawText: "Checking extracted question...",
			}),
		);
	});

	it("retries questions that fail later in the cycle without aborting", async () => {
		const failingStart = REVIEW_CONCURRENCY;
		const questions = Array.from({ length: REVIEW_CONCURRENCY + 2 }, (_, index) =>
			makeQuestion(index),
		);

		reviewSingleQuestionMock.mockImplementation(async (_config, _text, _question, index) => {
			if (index >= failingStart) {
				return failureResult(index);
			}
			return successResult(index);
		});

		const result = await reviewExtraction(
			config,
			"source text",
			{ examName: "General Exam", questions, topics: ["General"] },
			{ reviewTopics: ["General"] },
		);

		expect(result.reviewedQuestionCount).toBe(REVIEW_CONCURRENCY);
		expect(result.failedQuestionCount).toBe(2);
		expect(reviewSingleQuestionMock).toHaveBeenCalledTimes(
			REVIEW_CONCURRENCY + 2 * MAX_REVIEW_ATTEMPTS,
		);
	});
});
