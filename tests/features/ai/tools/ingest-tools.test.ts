import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/ai", () => ({
	toolDefinition: (definition: Record<string, unknown>) => ({
		...definition,
		server: (handler: (input: unknown) => Promise<unknown>) => ({
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
	execute: (input: Record<string, unknown>) => Promise<unknown>;
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
