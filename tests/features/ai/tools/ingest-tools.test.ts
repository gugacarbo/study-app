import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/ai", () => ({
	toolDefinition: (definition: Record<string, unknown>) => ({
		...definition,
		server: (
			handler: (
				input: unknown,
				context?: { toolCallId?: string },
			) => Promise<unknown>,
		) => ({
			...definition,
			execute: handler,
		}),
	}),
}));

import {
	createExtractionWorkspace,
	createIngestExtractionTools,
} from "@/features/ai/tools/ingest-tools";

type Tool = {
	name: string;
	inputSchema: { safeParse: (input: unknown) => { success: boolean } };
	execute: (
		input: Record<string, unknown>,
		context?: { toolCallId?: string },
	) => Promise<unknown>;
};

function getTool(tools: readonly unknown[], name: string): Tool {
	const tool = tools.find((candidate) => (candidate as Tool).name === name);
	if (!tool) throw new Error(`Tool ${name} not found`);
	return tool as Tool;
}

describe("ingest extraction tools", () => {
	beforeEach(() => {
		vi.clearAllMocks();
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
				}),
			}),
		);
	});

	it("adds questions through add_extracted_question", async () => {
		const workspace = createExtractionWorkspace();
		const tools = createIngestExtractionTools(workspace);
		const addQuestion = getTool(tools, "add_extracted_question");

		expect(
			addQuestion.inputSchema.safeParse({
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
		})) as { ok: boolean; questionId: string; totalQuestions: number };

		expect(result.ok).toBe(true);
		expect(result.questionId).toBe("q1");
		expect(result.totalQuestions).toBe(1);
		expect(workspace.listQuestions()[0]?.explanation).toBe("");
	});

	it("accepts null optional fields from the model tool payload", async () => {
		const workspace = createExtractionWorkspace();
		const tools = createIngestExtractionTools(workspace);
		const addQuestion = getTool(tools, "add_extracted_question");

		expect(
			addQuestion.inputSchema.safeParse({
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
		})) as { ok: boolean; questionId: string; totalQuestions: number };

		expect(result).toEqual({
			ok: true,
			questionId: "q1",
			totalQuestions: 1,
		});
		expect(workspace.listQuestions()[0]).toMatchObject({
			question: "Qual e a derivada de f(x) = x²?",
			answer: "2x",
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
		};

		expect(result.ok).toBe(true);
		expect(result.questionId).toBe("q1");
		expect(result.updatedFields).toEqual(["question", "topic"]);
		expect(workspace.listQuestions()[0]).toMatchObject({
			question: "Pergunta corrigida",
			topic: "Topico 2",
		});
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
			updateQuestion.inputSchema.safeParse({
				questionId: "q1",
				question: null,
				options: null,
				answer: null,
				topic: null,
				explanation: null,
			}).success,
		).toBe(true);

		const result = (await updateQuestion.execute({
			questionId: "q1",
			question: null,
			options: null,
			answer: null,
			topic: null,
			explanation: null,
		})) as {
			ok: boolean;
			questionId: string;
			updatedFields: string[];
		};

		expect(result).toEqual({
			ok: true,
			questionId: "q1",
			updatedFields: [],
		});
		expect(workspace.listQuestions()[0]).toMatchObject({
			question: "Pergunta inicial",
			options: ["A", "B"],
			answer: "A",
			topic: "Topico 1",
		});
	});

	it("lists the current extraction workspace", async () => {
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
			data: Array<{ questionId: string }>;
		};

		expect(result).toEqual({
			ok: true,
			data: [
				expect.objectContaining({
					questionId: "q1",
				}),
			],
		});
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
				code: "QUESTION_NOT_FOUND",
				message:
					"Question q999 was not found in the current extraction workspace.",
			},
		});
	});
});
