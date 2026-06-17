import type { StepResult, ToolSet } from "ai";
import { describe, expect, it } from "vitest";
import {
	buildExtractionPrepareStep,
	buildImproveQuestionsStopWhen,
	buildIngestExplanationStopWhen,
	buildIngestExtractionStopWhen,
	buildIngestReviewPrepareStep,
	buildIngestReviewStopWhen,
	chatBlockedListToolLoop,
	chatDbSearchExhaustedStop,
	chatDbSearchFoundResults,
	buildChatStopWhen,
	ingestExtractionDuplicateAddDetected,
	ingestExtractionTargetReached,
	ingestReviewUpdateNoOpDetected,
	ingestStageStatusReported,
	repeatedToolCallInLastSteps,
} from "@/features/ai/core/tool-agent-stop-when";

function createStep(
	toolResults: Array<{ toolName: string; input?: unknown; output: unknown }>,
	options?: { text?: string },
): StepResult<ToolSet> {
	return {
		text: options?.text ?? "",
		toolResults: toolResults.map((result, index) => ({
			type: "tool-result" as const,
			toolCallId: `tc-${index}`,
			toolName: result.toolName,
			input: result.input ?? {},
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
	it("escalates to list_answer_keys after empty topic question search", async () => {
		const { buildChatPrepareStep } = await import(
			"@/features/ai/core/tool-agent-stop-when"
		);
		const prepareStep = buildChatPrepareStep([
			"list_questions",
			"list_answer_keys",
			"web_search",
		]);

		const result = prepareStep({
			steps: [
				createStep([
					{
						toolName: "list_questions",
						input: { topic: "Sistemas Operacionais" },
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

		expect(result).toEqual({
			activeTools: ["list_answer_keys"],
			toolChoice: { type: "tool", toolName: "list_answer_keys" },
		});
	});

	it("escalates to list_answer_keys after empty topic question search without tool input", async () => {
		const { buildChatPrepareStep } = await import(
			"@/features/ai/core/tool-agent-stop-when"
		);
		const prepareStep = buildChatPrepareStep([
			"list_questions",
			"list_answer_keys",
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

		expect(result).toEqual({
			activeTools: ["list_answer_keys"],
			toolChoice: { type: "tool", toolName: "list_answer_keys" },
		});
	});

	it("disables list_questions after a successful result with items", async () => {
		const { buildChatPrepareStep } = await import(
			"@/features/ai/core/tool-agent-stop-when"
		);
		const prepareStep = buildChatPrepareStep([
			"list_questions",
			"list_answer_keys",
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
								items: [{ id: 1 }],
								pagination: { hasNextPage: false },
							},
						},
					},
				]),
			],
		} as never);

		expect(result).toEqual({ toolChoice: "none" });
	});

	it("disables web_search after any successful DB list tool call", async () => {
		const { buildChatPrepareStep } = await import(
			"@/features/ai/core/tool-agent-stop-when"
		);
		const prepareStep = buildChatPrepareStep([
			"list_questions",
			"list_answer_keys",
			"web_search",
			"web_fetch",
		]);

		const result = prepareStep({
			steps: [
				createStep([
					{
						toolName: "list_questions",
						input: { topic: "Sistemas Operacionais" },
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

		expect(result).toEqual({
			activeTools: ["list_answer_keys"],
			toolChoice: { type: "tool", toolName: "list_answer_keys" },
		});
	});

	it("forces text when search is exhausted", async () => {
		const { buildChatPrepareStep } = await import(
			"@/features/ai/core/tool-agent-stop-when"
		);
		const prepareStep = buildChatPrepareStep([
			"list_questions",
			"list_answer_keys",
			"list_exams",
		]);

		const result = prepareStep({
			steps: [
				createStep([
					{
						toolName: "list_questions",
						input: { topic: "Sistemas Operacionais" },
						output: {
							ok: true,
							data: { items: [], pagination: { hasNextPage: false } },
						},
					},
					{
						toolName: "list_answer_keys",
						input: { textContains: "Sistemas Operacionais" },
						output: {
							ok: true,
							data: { items: [], pagination: { hasNextPage: false } },
						},
					},
					{
						toolName: "list_exams",
						input: { nameContains: "Sistemas Operacionais" },
						output: {
							ok: true,
							data: { items: [], pagination: { hasNextPage: false } },
						},
					},
				]),
			],
		} as never);

		expect(result).toEqual({ toolChoice: "none" });
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

		expect(result).toEqual({ activeTools: ["list_questions"] });
	});

	it("forces text after list_answer_keys returns matching rows", async () => {
		const { buildChatPrepareStep } = await import(
			"@/features/ai/core/tool-agent-stop-when"
		);
		const prepareStep = buildChatPrepareStep([
			"list_questions",
			"list_answer_keys",
			"web_search",
		]);

		const result = prepareStep({
			steps: [
				createStep([
					{
						toolName: "list_questions",
						input: { topic: "Sistemas Operacionais" },
						output: {
							ok: true,
							data: { items: [], pagination: { hasNextPage: false } },
						},
					},
				]),
				createStep([
					{
						toolName: "list_answer_keys",
						input: { textContains: "Sistemas Operacionais" },
						output: {
							ok: true,
							data: {
								items: [{ id: 237 }, { id: 232 }],
								pagination: { hasNextPage: false },
							},
						},
					},
				]),
			],
		} as never);

		expect(result).toEqual({ toolChoice: "none" });
	});

	it("does not force text again after the assistant already replied", async () => {
		const { buildChatPrepareStep } = await import(
			"@/features/ai/core/tool-agent-stop-when"
		);
		const prepareStep = buildChatPrepareStep([
			"list_questions",
			"list_answer_keys",
		]);

		const result = prepareStep({
			steps: [
				createStep([
					{
						toolName: "list_answer_keys",
						input: { textContains: "Sistemas Operacionais" },
						output: {
							ok: true,
							data: {
								items: [{ id: 237 }],
								pagination: { hasNextPage: false },
							},
						},
					},
				]),
				createStep([], {
					text: "Encontrei 1 questão sobre Sistemas Operacionais.",
				}),
			],
		} as never);

		expect(result).toEqual({});
	});
});

describe("chatDbSearchFoundResults", () => {
	it("stops when list_answer_keys returns items", () => {
		expect(
			chatDbSearchFoundResults({
				steps: [
					createStep([
						{
							toolName: "list_answer_keys",
							output: {
								ok: true,
								data: {
									items: [{ id: 1 }, { id: 2 }],
									pagination: { hasNextPage: false },
								},
							},
						},
					]),
				],
			}),
		).toBe(true);
	});

	it("does not stop when list_questions returns an empty page", () => {
		expect(
			chatDbSearchFoundResults({
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
			}),
		).toBe(false);
	});

	it("does not stop when list_exams finds exams", () => {
		expect(
			chatDbSearchFoundResults({
				steps: [
					createStep([
						{
							toolName: "list_exams",
							output: {
								ok: true,
								data: {
									items: [{ id: 125 }],
									pagination: { hasNextPage: false },
								},
							},
						},
					]),
				],
			}),
		).toBe(false);
	});
});

describe("buildChatStopWhen", () => {
	it("only applies a step limit so the agent can answer after tool results", () => {
		expect(buildChatStopWhen()).toHaveLength(1);
		expect(buildChatStopWhen(6)).toHaveLength(1);
	});

	it("stops when the DB search escalation is exhausted", () => {
		expect(
			chatDbSearchExhaustedStop({
				steps: [
					createStep([
						{
							toolName: "list_questions",
							input: { topic: "Sistemas Operacionais" },
							output: {
								ok: true,
								data: { items: [], pagination: { hasNextPage: false } },
							},
						},
						{
							toolName: "list_answer_keys",
							input: { textContains: "Sistemas Operacionais" },
							output: {
								ok: true,
								data: { items: [], pagination: { hasNextPage: false } },
							},
						},
						{
							toolName: "list_exams",
							input: { nameContains: "Sistemas Operacionais" },
							output: {
								ok: true,
								data: { items: [], pagination: { hasNextPage: false } },
							},
						},
					]),
				],
			}),
		).toBe(true);
	});

	it("stops when the last step only has blocked duplicate list tool calls", () => {
		expect(
			chatBlockedListToolLoop({
				steps: [
					createStep([
						{
							toolName: "list_questions",
							output: {
								ok: false,
								error: { code: "DUPLICATE_TOOL_CALL" },
							},
						},
					]),
				],
			}),
		).toBe(true);
	});

	it("does not stop on duplicate when textContains search is still pending", () => {
		expect(
			chatBlockedListToolLoop({
				steps: [
					createStep([
						{
							toolName: "list_questions",
							input: { topic: "Sistemas Operacionais" },
							output: {
								ok: true,
								data: { items: [], pagination: { hasNextPage: false } },
							},
						},
					]),
					createStep([
						{
							toolName: "list_questions",
							input: { topic: "Sistemas Operacionais" },
							output: {
								ok: false,
								error: { code: "DUPLICATE_TOOL_CALL" },
							},
						},
					]),
				],
			}),
		).toBe(false);
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
		expect(buildIngestExtractionStopWhen(15)).toHaveLength(1);
		expect(buildIngestReviewStopWhen(12)).toHaveLength(1);
		expect(buildIngestExplanationStopWhen(12)).toHaveLength(1);
		expect(buildImproveQuestionsStopWhen(12)).toHaveLength(1);
	});
});

describe("buildExtractionPrepareStep", () => {
	it("restricts to report_agent_stage_status after the expected question count is reached", () => {
		const workspace = {
			listQuestions: () => [{ id: "q1" }, { id: "q2" }],
		};
		const prepareStep = buildExtractionPrepareStep(workspace, {
			expectedQuestionCount: 2,
		});

		expect(
			prepareStep({
				steps: [
					createStep([
						{
							toolName: "add_extracted_question",
							output: { ok: true, questionId: "q2", totalQuestions: 2 },
						},
					]),
				],
			} as Parameters<typeof prepareStep>[0]),
		).toEqual({
			activeTools: ["report_agent_stage_status"],
			toolChoice: {
				type: "tool",
				toolName: "report_agent_stage_status",
			},
		});
	});

	it("stops tool calls after report_agent_stage_status succeeds", () => {
		const workspace = {
			listQuestions: () => [{ id: "q1" }],
		};
		const prepareStep = buildExtractionPrepareStep(workspace, {
			expectedQuestionCount: 1,
		});

		expect(
			prepareStep({
				steps: [
					createStep([
						{
							toolName: "report_agent_stage_status",
							output: {
								ok: true,
								status: "success",
								message: "Extracted 1 question.",
							},
						},
					]),
				],
			} as Parameters<typeof prepareStep>[0]),
		).toEqual({ toolChoice: "none" });
	});

	it("restricts to report_agent_stage_status after repeated list_extracted_questions", () => {
		const prepareStep = buildExtractionPrepareStep({
			listQuestions: () => [],
		});

		expect(
			prepareStep({
				steps: [
					createStep([
						{
							toolName: "list_extracted_questions",
							output: { ok: true, totalQuestions: 0, data: [] },
						},
					]),
					createStep([
						{
							toolName: "list_extracted_questions",
							output: { ok: true, totalQuestions: 0, data: [] },
						},
					]),
				],
			} as Parameters<typeof prepareStep>[0]),
		).toEqual({
			activeTools: ["report_agent_stage_status"],
			toolChoice: {
				type: "tool",
				toolName: "report_agent_stage_status",
			},
		});
	});
});

describe("buildIngestReviewPrepareStep", () => {
	it("restricts to report_agent_stage_status after update_extracted_question", () => {
		const prepareStep = buildIngestReviewPrepareStep({
			shouldFinalize: () => false,
		});

		expect(
			prepareStep({
				steps: [
					createStep([
						{
							toolName: "update_extracted_question",
							output: { ok: true, questionId: "q1", updatedFields: ["topic"] },
						},
					]),
				],
			} as Parameters<typeof prepareStep>[0]),
		).toEqual({
			activeTools: ["report_agent_stage_status"],
			toolChoice: {
				type: "tool",
				toolName: "report_agent_stage_status",
			},
		});
	});
});
