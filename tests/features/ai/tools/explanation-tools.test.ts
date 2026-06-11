import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolSet } from "ai";
import {
	createExplanationTools,
	createExplanationWorkspace,
} from "@/features/ai/tools/explanation-tools";
import { explanationPatchSchema } from "@/features/ai/tools/explanation-tools/tools";

type ExecutableTool = {
	execute: (input: Record<string, unknown>) => Promise<unknown>;
};

function getTool(tools: ToolSet, name: string): ExecutableTool {
	const tool = tools[name];
	if (!tool?.execute) throw new Error(`Tool ${name} not found`);
	return tool as unknown as ExecutableTool;
}

describe("explanation tools", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("updates explanations through update_question_explanation", async () => {
		const workspace = createExplanationWorkspace([
			{
				id: 10,
				question: "O que e cache?",
				options: ["A", "B"],
				answers: ["A"],
				topic: "Memoria",
			},
		]);
		const tools = createExplanationTools(workspace);
		const updateExplanation = getTool(tools, "update_question_explanation");

		const result = (await updateExplanation.execute({
			questionId: 10,
			explanation: "Curta",
			deepExplanation: "Longa",
		})) as {
			ok: boolean;
			questionId: number;
			updatedFields: string[];
		};

		expect(result).toEqual({
			ok: true,
			questionId: 10,
			updatedFields: ["explanation", "deepExplanation"],
		});
		expect(workspace.buildResult()).toEqual({
			questions: [
				{
					id: 10,
					explanation: "Curta",
					deepExplanation: "Longa",
				},
			],
		});
	});

	it("rejects update_question_explanation when required text fields are missing", () => {
		expect(
			explanationPatchSchema.safeParse({ questionId: 10 }).success,
		).toBe(false);
		expect(
			explanationPatchSchema.safeParse({
				questionId: 10,
				explanation: "Curta",
			}).success,
		).toBe(false);
	});

	it("lists questions through list_explanation_questions", async () => {
		const workspace = createExplanationWorkspace([
			{
				id: 11,
				question: "Pergunta",
				options: ["A", "B"],
				answers: ["A"],
			},
		]);
		const tools = createExplanationTools(workspace);
		const listQuestions = getTool(tools, "list_explanation_questions");

		const result = (await listQuestions.execute({})) as {
			ok: boolean;
			data: Array<{ id: number; hasDeepExplanation: boolean }>;
		};

		expect(result.ok).toBe(true);
		expect(result.data).toEqual([
			expect.objectContaining({
				id: 11,
				hasExplanation: false,
				hasDeepExplanation: false,
			}),
		]);
	});

	it("rejects buildResult when explanations are incomplete", () => {
		const workspace = createExplanationWorkspace([
			{
				id: 12,
				question: "Pergunta",
				options: ["A", "B"],
				answers: ["A"],
			},
		]);

		expect(() => workspace.buildResult()).toThrow(
			/Missing explanations for question id\(s\): 12/,
		);
	});
});
