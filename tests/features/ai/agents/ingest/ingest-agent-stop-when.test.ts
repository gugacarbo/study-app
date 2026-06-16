import type { StepResult, ToolSet } from "ai";
import { describe, expect, it } from "vitest";
import {
	buildImproveQuestionsPrepareStep,
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
		expect(buildIngestExtractionStopWhen(15)).toHaveLength(4);
		expect(
			buildIngestExtractionStopWhen(15, { expectedQuestionCount: 3 }),
		).toHaveLength(5);
		expect(buildIngestReviewStopWhen(12)).toHaveLength(4);
		expect(buildIngestExplanationStopWhen(12)).toHaveLength(2);
		expect(buildImproveQuestionsStopWhen(12)).toHaveLength(7);
	});

	it("disables check_spelling for the rest of the run after it succeeds once", () => {
		const prepareStep = buildImproveQuestionsPrepareStep(() => false);
		const next = prepareStep({
			steps: [
				createStep([
					{
						toolName: "get_question",
						output: { ok: true, data: { id: 807 } },
					},
				]),
				createStep([
					{
						toolName: "check_spelling",
						output: {
							ok: true,
							language: "pt-BR",
							checkedWordCount: 2,
							issues: [{ word: "arvore", suggestions: ["árvore"] }],
							truncated: false,
						},
					},
				]),
			],
		} as Parameters<typeof prepareStep>[0]) as {
			activeTools?: string[];
		};

		expect(next.activeTools).toEqual([
			"update_question_options",
			"get_question",
			"web_search",
			"web_fetch",
		]);
		expect(next.activeTools).not.toContain("check_spelling");
	});
});
