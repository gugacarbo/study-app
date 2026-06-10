import { describe, expect, it } from "vitest";
import type { DraftQuestion } from "@/features/ai/agents/improve-options/contracts";
import {
	createImproveOptionsWorkspace,
	ImproveOptionsWorkspaceError,
} from "@/features/ai/tools/improve-options-tools/workspace";

const baseQuestion: DraftQuestion = {
	id: 42,
	question: "Qual e a capital do Brasil?",
	options: ["Sao Paulo", "Rio de Janeiro", "Brasilia", "Salvador", "Recife"],
	answers: ["Brasilia"],
	scoringMode: "exact",
	explanation: "Brasilia e a capital federal.",
};

describe("improve-options workspace", () => {
	it("returns seeded questions and tracks updated fields against baseline", () => {
		const workspace = createImproveOptionsWorkspace({
			questions: [baseQuestion],
		});

		expect(workspace.listQuestions()).toEqual([baseQuestion]);
		expect(workspace.getQuestion(42)).toEqual(baseQuestion);
		expect(workspace.getUpdatedFields(42)).toEqual([]);

		const updated = workspace.updateQuestion(42, {
			options: [
				"Sao Paulo",
				"Rio de Janeiro",
				"Brasilia",
				"Salvador",
				"Belo Horizonte",
			],
			answers: ["Brasilia"],
		});

		expect(updated.options).toEqual([
			"Sao Paulo",
			"Rio de Janeiro",
			"Brasilia",
			"Salvador",
			"Belo Horizonte",
		]);
		expect(workspace.getUpdatedFields(42)).toEqual(["options"]);
	});

	it("rejects fewer than 5 options and answers outside options", () => {
		const workspace = createImproveOptionsWorkspace({
			questions: [baseQuestion],
		});

		expect(() =>
			workspace.updateQuestion(42, {
				options: ["A", "B", "C", "D"],
				answers: ["A"],
			}),
		).toThrowError(ImproveOptionsWorkspaceError);

		expect(() =>
			workspace.updateQuestion(42, {
				options: [
					"Sao Paulo",
					"Rio de Janeiro",
					"Brasilia",
					"Salvador",
					"Recife",
				],
				answers: ["Curitiba"],
			}),
		).toThrowError(/Every answer must match one of the question options/);
	});

	it("rejects unknown question ids", () => {
		const workspace = createImproveOptionsWorkspace({
			questions: [baseQuestion],
		});

		expect(() => workspace.getQuestion(999)).toThrowError(
			ImproveOptionsWorkspaceError,
		);
		expect(() =>
			workspace.updateQuestion(999, {
				explanation: "Nao existe",
			}),
		).toThrowError(
			"Question 999 was not found in the improve-options workspace.",
		);
	});
});
