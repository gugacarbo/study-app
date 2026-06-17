import type { StepResult, ToolSet } from "ai";
import { describe, expect, it } from "vitest";
import {
	buildImproveQuestionsStopWhen,
	buildIngestExplanationStopWhen,
	buildIngestExtractionStopWhen,
	buildIngestReviewStopWhen,
	ingestExtractionDuplicateAddDetected,
	ingestExtractionTargetReached,
	ingestReviewUpdateNoOpDetected,
	ingestStageStatusReported,
	repeatedToolCallInLastSteps,
} from "@/features/ai/core/tool-agent-stop-when";

function createStep(
	toolResults: Array<{ toolName: string; output: unknown }>,
): StepResult<ToolSet> {
	return {
		toolResults: toolResults.map((result, index) => ({
			type: "tool-result" as const,
			toolCallId: `tc-${index}`,
			toolName: result.toolName,
			input: {},
			output: result.output,
		})),
	} as StepResult<ToolSet>;
}

describe("ingestExtractionDuplicateAddDetected", () => {
	it("stops when add_extracted_question returns alreadyExists", () => {
		const condition = ingestExtractionDuplicateAddDetected;

		expect(
			condition({
				steps: [
					createStep([
						{
							toolName: "add_extracted_question",
							output: { ok: true, questionId: "q1", alreadyExists: true },
						},
					]),
				],
			}),
		).toBe(true);
	});

	it("does not stop after a successful add", () => {
		const condition = ingestExtractionDuplicateAddDetected;

		expect(
			condition({
				steps: [
					createStep([
						{
							toolName: "add_extracted_question",
							output: { ok: true, questionId: "q1", totalQuestions: 1 },
						},
					]),
				],
			}),
		).toBe(false);
	});
});

describe("ingestReviewUpdateNoOpDetected", () => {
	it("stops when update_extracted_question is a no-op", () => {
		expect(
			ingestReviewUpdateNoOpDetected({
				steps: [
					createStep([
						{
							toolName: "update_extracted_question",
							output: { ok: true, questionId: "q1", updatedFields: [] },
						},
					]),
				],
			}),
		).toBe(true);
	});
});

describe("repeatedToolCallInLastSteps", () => {
	it("stops after the same tool is called in consecutive steps", () => {
		const condition = repeatedToolCallInLastSteps("list_extracted_questions");

		expect(
			condition({
				steps: [
					createStep([
						{
							toolName: "list_extracted_questions",
							output: { ok: true, totalQuestions: 1, data: [] },
						},
					]),
					createStep([
						{
							toolName: "list_extracted_questions",
							output: { ok: true, totalQuestions: 1, data: [] },
						},
					]),
				],
			}),
		).toBe(true);
	});
});

describe("buildChatPrepareStep", () => {
	it("disables list_questions after a successful final page", async () => {
		const { buildChatPrepareStep } = await import(
			"@/features/ai/core/tool-agent-stop-when"
		);
		const prepareStep = buildChatPrepareStep([
			"list_questions",
			"web_search",
		]);

		const result = prepareStep({
			steps: [
				createStep([
					{
						toolName: "list_questions",
						output: {
							ok: true,
							data: {
								items: [],
								pagination: { hasNextPage: false },
							},
						},
					},
				]),
			],
		} as never);

		expect(result).toEqual({ activeTools: ["web_search"] });
	});

	it("keeps list_questions available when pagination continues", async () => {
		const { buildChatPrepareStep } = await import(
			"@/features/ai/core/tool-agent-stop-when"
		);
		const prepareStep = buildChatPrepareStep([
			"list_questions",
			"web_search",
		]);

		const result = prepareStep({
			steps: [
				createStep([
					{
						toolName: "list_questions",
						output: {
							ok: true,
							data: {
								items: [],
								pagination: { hasNextPage: true },
							},
						},
					},
				]),
			],
		} as never);

		expect(result).toEqual({});
	});
});

describe("ingestStageStatusReported", () => {
	it("stops when report_agent_stage_status succeeds", () => {
		expect(
			ingestStageStatusReported({
				steps: [
					createStep([
						{
							toolName: "report_agent_stage_status",
							output: {
								ok: true,
								status: "success",
								message: "Extracted 2 questions.",
							},
						},
					]),
				],
			}),
		).toBe(true);
	});
});

describe("ingestExtractionTargetReached", () => {
	it("stops when the expected question count is registered", () => {
		const condition = ingestExtractionTargetReached(2);

		expect(
			condition({
				steps: [
					createStep([
						{
							toolName: "add_extracted_question",
							output: { ok: true, questionId: "q2", totalQuestions: 2 },
						},
					]),
				],
			}),
		).toBe(true);
	});

	it("does not stop before the expected question count is reached", () => {
		const condition = ingestExtractionTargetReached(2);

		expect(
			condition({
				steps: [
					createStep([
						{
							toolName: "add_extracted_question",
							output: { ok: true, questionId: "q1", totalQuestions: 1 },
						},
					]),
				],
			}),
		).toBe(false);
	});
});

describe("ingest agent stopWhen builders", () => {
	it("builds extraction, review, and explanation stop conditions", () => {
		expect(buildIngestExtractionStopWhen(15)).toHaveLength(3);
		expect(
			buildIngestExtractionStopWhen(15, { expectedQuestionCount: 3 }),
		).toHaveLength(4);
		expect(buildIngestReviewStopWhen(12)).toHaveLength(3);
		expect(buildIngestExplanationStopWhen(12)).toHaveLength(1);
		expect(buildImproveQuestionsStopWhen(12)).toHaveLength(1);
	});
});
