import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolSet } from "ai";
import {
	createExtractionWorkspace,
	createIngestExtractionTools,
	createIngestReviewTools,
} from "@/features/ai/tools/ingest-tools";
import {
	ExtractionWorkspaceError,
	type ExtractionWorkspaceQuestion,
} from "@/features/ai/tools/ingest-tools/workspace";
import {
	extractionQuestionFieldsSchema,
	extractionQuestionIdSchema,
	extractionQuestionPatchSchema,
	extractionToolFailureSchema,
	extractionToolSuccessBaseSchema,
	INGEST_TOOL_ERROR_CODE,
	QUESTION_NOT_FOUND_ERROR_CODE,
} from "@/features/ai/tools/ingest-tools/shared";
import {
	createIngestExtractionTools as createToolsFromModule,
} from "@/features/ai/tools/ingest-tools/tools";

type ExecutableTool = {
	execute: (
		input: Record<string, unknown>,
		context?: { toolCallId?: string },
	) => Promise<unknown>;
};

function getTool(tools: ToolSet, name: string): ExecutableTool {
	const tool = tools[name];
	if (!tool?.execute) throw new Error(`Tool ${name} not found`);
	return tool as unknown as ExecutableTool;
}

function expectStructuredFailure(result: unknown) {
	expect(extractionToolFailureSchema.safeParse(result).success).toBe(true);
	const parsed = extractionToolFailureSchema.parse(result);
	expect(parsed.error.code.length).toBeGreaterThan(0);
	expect(parsed.error.message.length).toBeGreaterThan(0);
	return parsed;
}

function expectStructuredSuccess(result: unknown) {
	expect(extractionToolSuccessBaseSchema.safeParse(result).success).toBe(true);
	return extractionToolSuccessBaseSchema.parse(result);
}

describe("ingest extraction tool schemas", () => {
	it("rejects invalid question ids", () => {
		expect(extractionQuestionIdSchema.safeParse("q1").success).toBe(true);
		expect(extractionQuestionIdSchema.safeParse("question-1").success).toBe(
			false,
		);
	});

	it("normalizes legacy answer into answers on add", () => {
		const parsed = extractionQuestionFieldsSchema.parse({
			question: "Q1",
			options: ["A", "B"],
			answer: "A",
		});

		expect(parsed.answers).toEqual(["A"]);
		expect("answer" in parsed).toBe(false);
	});

	it("normalizes legacy answer into answers on patch", () => {
		const parsed = extractionQuestionPatchSchema.parse({
			questionId: "q1",
			answer: "B",
		});

		expect(parsed.answers).toEqual(["B"]);
		expect("answer" in parsed).toBe(false);
	});
});

describe("ingest extraction tools", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not include report_agent_stage_status in extraction tools", () => {
		const workspace = createExtractionWorkspace();
		const tools = createIngestExtractionTools(workspace);

		expect(tools.report_agent_stage_status).toBeUndefined();
	});

	it("omits add and list tools from createIngestReviewTools", () => {
		const workspace = createExtractionWorkspace({
			questions: [
				{
					questionId: "q1",
					question: "Q1",
					options: ["A", "B"],
					answers: ["A"],
					scoringMode: "exact",
					explanation: "",
					topic: "General",
				},
			],
			nextQuestionNumber: 2,
		});
		const tools = createIngestReviewTools(workspace);

		expect(tools.add_extracted_question).toBeUndefined();
		expect(tools.list_extracted_questions).toBeUndefined();
		expect(tools.update_extracted_question).toBeDefined();
		expect(tools.report_agent_stage_status).toBeUndefined();
	});

	it("notifies onToolExecuted with toolCallId from execution context", async () => {
		const workspace = createExtractionWorkspace();
		const onToolExecuted = vi.fn();
		const tools = createIngestExtractionTools(workspace, { onToolExecuted });
		const addQuestion = getTool(tools, "add_extracted_question");

		await addQuestion.execute(
			{
				question: "Q1",
				options: ["A", "B"],
				answer: "A",
				topic: "Topico",
			},
			{ toolCallId: "tc-live-1" },
		);

		expect(onToolExecuted).toHaveBeenCalledWith(
			expect.objectContaining({
				toolCallId: "tc-live-1",
				toolName: "add_extracted_question",
				output: expect.objectContaining({
					ok: true,
					questionId: "q1",
					message: expect.stringContaining("Question registered"),
				}),
			}),
		);
	});

	it("does not notify onToolExecuted when toolCallId is missing", async () => {
		const workspace = createExtractionWorkspace();
		const onToolExecuted = vi.fn();
		const tools = createIngestExtractionTools(workspace, { onToolExecuted });
		const listQuestions = getTool(tools, "list_extracted_questions");

		await listQuestions.execute({});

		expect(onToolExecuted).not.toHaveBeenCalled();
	});

	it("returns alreadyExists when add_extracted_question receives a duplicate question", async () => {
		const workspace = createExtractionWorkspace();
		const tools = createIngestExtractionTools(workspace);
		const addQuestion = getTool(tools, "add_extracted_question");

		await addQuestion.execute({
			question: "Q1",
			options: ["A", "B"],
			answer: "A",
			topic: "Topico",
		});
		const duplicate = (await addQuestion.execute({
			question: "Q1",
			options: ["A", "B"],
			answer: "A",
			topic: "Topico",
		})) as {
			ok: boolean;
			questionId: string;
			totalQuestions: number;
			alreadyExists?: boolean;
			message: string;
		};

		expectStructuredSuccess(duplicate);
		expect(duplicate).toEqual({
			ok: true,
			added: false,
			questionId: "q1",
			totalQuestions: 1,
			alreadyExists: true,
			message:
				"This question is already registered. Stop calling add_extracted_question. Use update_extracted_question only if a correction is needed.",
		});
		expect(workspace.listQuestions()).toHaveLength(1);
	});

	it("returns alreadyExists for the same stem with and without a leading number", async () => {
		const workspace = createExtractionWorkspace();
		const tools = createIngestExtractionTools(workspace);
		const addQuestion = getTool(tools, "add_extracted_question");

		await addQuestion.execute({
			question: "7. Uma arvore binaria e um caso especial de arvore em que:",
			options: ["A", "B"],
			answer: "B",
		});
		const duplicate = (await addQuestion.execute({
			question: "Uma arvore binaria e um caso especial de arvore em que:",
			options: ["A", "B"],
			answer: "B",
		})) as { alreadyExists?: boolean; totalQuestions: number };

		expect(duplicate.alreadyExists).toBe(true);
		expect(duplicate.totalQuestions).toBe(1);
	});

	it("adds questions through add_extracted_question", async () => {
		const workspace = createExtractionWorkspace();
		const tools = createIngestExtractionTools(workspace);
		const addQuestion = getTool(tools, "add_extracted_question");

		expect(
			extractionQuestionFieldsSchema.safeParse({
				question: "Q1",
				options: ["A", "B"],
				answer: "A",
			}).success,
		).toBe(true);

		const result = (await addQuestion.execute({
			question: "Q1",
			options: ["A", "B"],
			answer: "A",
			explanation: "ignorar",
			topic: "Topico",
		})) as {
			ok: boolean;
			added: boolean;
			questionId: string;
			totalQuestions: number;
			message: string;
		};

		expectStructuredSuccess(result);
		expect(result).toMatchObject({
			ok: true,
			added: true,
			questionId: "q1",
			totalQuestions: 1,
			message:
				"Question registered. Continue only if more distinct source questions remain; otherwise stop.",
		});
		expect(workspace.listQuestions()[0]?.explanation).toBe("");
	});

	it("returns workspace validation errors from add_extracted_question", async () => {
		const workspace = {
			listQuestions: () => [] as ExtractionWorkspaceQuestion[],
			addQuestion: () => {
				throw new ExtractionWorkspaceError(
					INGEST_TOOL_ERROR_CODE,
					"Unable to validate extracted question.",
				);
			},
			updateQuestion: vi.fn(),
		};
		const tools = createToolsFromModule(workspace);
		const addQuestion = getTool(tools, "add_extracted_question");

		const result = await addQuestion.execute({
			question: "Q1",
			options: ["A", "B"],
			answer: "A",
		});

		expect(result).toEqual({
			ok: false,
			error: {
				code: INGEST_TOOL_ERROR_CODE,
				message: "Unable to validate extracted question.",
			},
		});
		expectStructuredFailure(result);
	});

	it("returns INGEST_TOOL_ERROR for unexpected workspace failures", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const workspace = {
			listQuestions: () => [] as ExtractionWorkspaceQuestion[],
			addQuestion: () => {
				throw new Error("workspace persistence failed");
			},
			updateQuestion: vi.fn(),
		};
		const tools = createToolsFromModule(workspace);
		const addQuestion = getTool(tools, "add_extracted_question");

		const result = await addQuestion.execute({
			question: "Q1",
			options: ["A", "B"],
			answer: "A",
		});

		expect(result).toEqual({
			ok: false,
			error: {
				code: INGEST_TOOL_ERROR_CODE,
				message: "workspace persistence failed",
			},
		});
		expectStructuredFailure(result);
		consoleError.mockRestore();
	});

	it("accepts null optional fields from the model tool payload", async () => {
		const workspace = createExtractionWorkspace();
		const tools = createIngestExtractionTools(workspace);
		const addQuestion = getTool(tools, "add_extracted_question");

		expect(
			extractionQuestionFieldsSchema.safeParse({
				question: "Qual e a derivada de f(x) = x²?",
				options: ["1", "2x", "x²", "2"],
				answer: "2x",
				explanation: null,
				topic: null,
			}).success,
		).toBe(true);

		const result = (await addQuestion.execute({
			question: "Qual e a derivada de f(x) = x²?",
			options: ["1", "2x", "x²", "2"],
			answer: "2x",
			explanation: null,
			topic: null,
		})) as { ok: boolean; questionId: string; totalQuestions: number; message: string };

		expect(result).toEqual({
			ok: true,
			added: true,
			questionId: "q1",
			totalQuestions: 1,
			message:
				"Question registered. Continue only if more distinct source questions remain; otherwise stop.",
		});
		expect(workspace.listQuestions()[0]).toMatchObject({
			question: "Qual e a derivada de f(x) = x²?",
			answers: ["2x"],
			explanation: "",
			topic: "General",
		});
	});

	it("updates questions through update_extracted_question", async () => {
		const workspace = createExtractionWorkspace();
		const tools = createIngestExtractionTools(workspace);
		const addQuestion = getTool(tools, "add_extracted_question");
		const updateQuestion = getTool(tools, "update_extracted_question");

		await addQuestion.execute({
			question: "Pergunta inicial",
			options: ["A", "B"],
			answer: "A",
			topic: "Topico 1",
		});

		const result = (await updateQuestion.execute({
			questionId: "q1",
			question: "Pergunta corrigida",
			topic: "Topico 2",
		})) as {
			ok: boolean;
			questionId: string;
			updatedFields: string[];
			message: string;
		};

		expectStructuredSuccess(result);
		expect(result.ok).toBe(true);
		expect(result.questionId).toBe("q1");
		expect(result.updatedFields).toEqual(["question", "topic"]);
		expect(result.message).toBe(
			"Updated q1: question, topic. Stop if no further corrections are needed.",
		);
		expect(workspace.listQuestions()[0]).toMatchObject({
			question: "Pergunta corrigida",
			topic: "Topico 2",
		});
	});

	it("updates individual fields through update_extracted_question", async () => {
		const workspace = createExtractionWorkspace();
		const tools = createIngestExtractionTools(workspace);
		const addQuestion = getTool(tools, "add_extracted_question");
		const updateQuestion = getTool(tools, "update_extracted_question");

		await addQuestion.execute({
			question: "Pergunta inicial",
			options: ["A", "B", "C"],
			answer: "A",
			topic: "Topico 1",
		});

		const optionsResult = (await updateQuestion.execute({
			questionId: "q1",
			options: ["A", "B", "C", "D"],
		})) as { updatedFields: string[]; message: string };
		expect(optionsResult.updatedFields).toEqual(["options"]);
		expect(optionsResult.message).toContain("options");

		const answersResult = (await updateQuestion.execute({
			questionId: "q1",
			answers: ["B"],
		})) as { updatedFields: string[] };
		expect(answersResult.updatedFields).toEqual(["answers"]);

		const scoringResult = (await updateQuestion.execute({
			questionId: "q1",
			scoringMode: "partial",
		})) as { updatedFields: string[] };
		expect(scoringResult.updatedFields).toEqual(["scoringMode"]);

		const explanationResult = (await updateQuestion.execute({
			questionId: "q1",
			explanation: "ignored during extraction",
		})) as { updatedFields: string[] };
		expect(explanationResult.updatedFields).toEqual(["explanation"]);
		expect(workspace.listQuestions()[0]?.explanation).toBe("");
	});

	it("treats null update fields as a no-op in update_extracted_question", async () => {
		const workspace = createExtractionWorkspace();
		const tools = createIngestExtractionTools(workspace);
		const addQuestion = getTool(tools, "add_extracted_question");
		const updateQuestion = getTool(tools, "update_extracted_question");

		await addQuestion.execute({
			question: "Pergunta inicial",
			options: ["A", "B"],
			answer: "A",
			topic: "Topico 1",
		});

		expect(
			extractionQuestionPatchSchema.safeParse({
				questionId: "q1",
				question: null,
				options: null,
				answers: null,
				topic: null,
				explanation: null,
			}).success,
		).toBe(true);

		const result = (await updateQuestion.execute({
			questionId: "q1",
			question: null,
			options: null,
			answers: null,
			topic: null,
			explanation: null,
		})) as {
			ok: boolean;
			questionId: string;
			updatedFields: string[];
			message: string;
		};

		expectStructuredSuccess(result);
		expect(result).toEqual({
			ok: true,
			questionId: "q1",
			updatedFields: [],
			message:
				"No changes applied to q1. The question is already correct — stop calling update_extracted_question.",
		});
		expect(workspace.listQuestions()[0]).toMatchObject({
			question: "Pergunta inicial",
			options: ["A", "B"],
			answers: ["A"],
			topic: "Topico 1",
		});
	});

	it("treats questionId-only update as a no-op", async () => {
		const workspace = createExtractionWorkspace();
		const tools = createIngestExtractionTools(workspace);
		const addQuestion = getTool(tools, "add_extracted_question");
		const updateQuestion = getTool(tools, "update_extracted_question");

		await addQuestion.execute({
			question: "Pergunta inicial",
			options: ["A", "B"],
			answer: "A",
		});

		const result = (await updateQuestion.execute({
			questionId: "q1",
		})) as { updatedFields: string[]; message: string };

		expect(result.updatedFields).toEqual([]);
		expect(result.message).toContain("No changes applied to q1");
	});

	it("accepts answers array in add_extracted_question", async () => {
		const workspace = createExtractionWorkspace();
		const tools = createIngestExtractionTools(workspace);
		const addQuestion = getTool(tools, "add_extracted_question");

		expect(
			extractionQuestionFieldsSchema.safeParse({
				question: "Somatória",
				options: ["01. Verdadeiro", "02. Falso", "04. Verdadeiro"],
				answers: ["01. Verdadeiro", "04. Verdadeiro"],
			}).success,
		).toBe(true);

		const result = (await addQuestion.execute({
			question: "Somatória",
			options: ["01. Verdadeiro", "02. Falso", "04. Verdadeiro"],
			answers: ["01. Verdadeiro", "04. Verdadeiro"],
		})) as { ok: boolean; questionId: string; message: string };

		expectStructuredSuccess(result);
		expect(result.ok).toBe(true);
		expect(workspace.listQuestions()[0]?.answers).toEqual([
			"01. Verdadeiro",
			"04. Verdadeiro",
		]);
	});

	it("lists an empty extraction workspace with an explicit message", async () => {
		const workspace = createExtractionWorkspace();
		const tools = createIngestExtractionTools(workspace);
		const listQuestions = getTool(tools, "list_extracted_questions");

		const result = (await listQuestions.execute({})) as {
			ok: boolean;
			totalQuestions: number;
			data: unknown[];
			message: string;
		};

		expectStructuredSuccess(result);
		expect(result).toEqual({
			ok: true,
			totalQuestions: 0,
			message: "No questions registered in the extraction workspace yet.",
			data: [],
		});
	});

	it("lists the current extraction workspace with full payload shape", async () => {
		const workspace = createExtractionWorkspace();
		const tools = createIngestExtractionTools(workspace);
		const addQuestion = getTool(tools, "add_extracted_question");
		const listQuestions = getTool(tools, "list_extracted_questions");

		await addQuestion.execute({
			question: "Questao discursiva",
			options: [],
			answer: "Resposta correta",
			topic: "Topico",
		});

		const result = (await listQuestions.execute({})) as {
			ok: boolean;
			totalQuestions: number;
			message: string;
			data: Array<{
				questionId: string;
				question: string;
				options: string[];
				answers: string[];
				scoringMode: string;
				topic: string;
			}>;
		};

		expectStructuredSuccess(result);
		expect(result.totalQuestions).toBe(1);
		expect(result.message).toBe(
			"Listed 1 question(s) from the extraction workspace.",
		);
		expect(result.data).toEqual([
			{
				questionId: "q1",
				question: "Questao discursiva",
				options: ["Resposta correta", "Resposta incorreta."],
				answers: ["Resposta correta"],
				scoringMode: "exact",
				topic: "Topico",
			},
		]);
	});

	it("lists every question in the extraction workspace", async () => {
		const workspace = createExtractionWorkspace();
		const tools = createIngestExtractionTools(workspace);
		const addQuestion = getTool(tools, "add_extracted_question");
		const listQuestions = getTool(tools, "list_extracted_questions");

		for (let index = 1; index <= 5; index += 1) {
			await addQuestion.execute({
				question: `Questao ${index}`,
				options: ["A", "B"],
				answer: "A",
				topic: `Topico ${index}`,
			});
		}

		const result = (await listQuestions.execute({})) as {
			ok: boolean;
			totalQuestions: number;
			data: Array<{ questionId: string; question: string }>;
			message: string;
		};

		expectStructuredSuccess(result);
		expect(result.totalQuestions).toBe(5);
		expect(result.data).toHaveLength(5);
		expect(result.message).toBe(
			"Listed 5 question(s) from the extraction workspace.",
		);
		expect(result.data.map((item) => item.questionId)).toEqual([
			"q1",
			"q2",
			"q3",
			"q4",
			"q5",
		]);
	});

	it("notifies onToolExecuted for list and update tools", async () => {
		const workspace = createExtractionWorkspace();
		const onToolExecuted = vi.fn();
		const tools = createIngestExtractionTools(workspace, { onToolExecuted });
		const addQuestion = getTool(tools, "add_extracted_question");
		const updateQuestion = getTool(tools, "update_extracted_question");
		const listQuestions = getTool(tools, "list_extracted_questions");

		await addQuestion.execute(
			{
				question: "Q1",
				options: ["A", "B"],
				answer: "A",
			},
			{ toolCallId: "tc-add" },
		);
		await listQuestions.execute({}, { toolCallId: "tc-list" });
		await updateQuestion.execute(
			{ questionId: "q1", topic: "Novo topico" },
			{ toolCallId: "tc-update" },
		);

		expect(onToolExecuted).toHaveBeenCalledWith(
			expect.objectContaining({
				toolCallId: "tc-list",
				toolName: "list_extracted_questions",
				output: expect.objectContaining({ ok: true, totalQuestions: 1 }),
			}),
		);
		expect(onToolExecuted).toHaveBeenCalledWith(
			expect.objectContaining({
				toolCallId: "tc-update",
				toolName: "update_extracted_question",
				output: expect.objectContaining({
					ok: true,
					updatedFields: ["topic"],
				}),
			}),
		);
	});

	it("returns a stable error payload for an unknown question id", async () => {
		const workspace = createExtractionWorkspace();
		const tools = createIngestExtractionTools(workspace);
		const updateQuestion = getTool(tools, "update_extracted_question");

		const result = await updateQuestion.execute({
			questionId: "q999",
			question: "Nao existe",
		});

		expect(result).toEqual({
			ok: false,
			error: {
				code: QUESTION_NOT_FOUND_ERROR_CODE,
				message:
					"Question q999 was not found in the current extraction workspace.",
			},
		});
		expectStructuredFailure(result);
	});
});
