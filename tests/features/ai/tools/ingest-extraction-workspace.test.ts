import { describe, expect, it } from "vitest";
import {
	createExtractionWorkspace,
	ExtractionWorkspaceError,
} from "@/features/ai/tools/ingest-tools/workspace";

describe("ingest extraction workspace", () => {
	it("assigns stable question ids and preserves insertion order", () => {
		const workspace = createExtractionWorkspace();

		const first = workspace.addQuestion({
			question: "O que e um processo?",
			options: ["Programa em execucao", "Arquivo compactado"],
			answers: ["Programa em execucao"],
			topic: "Sistemas Operacionais",
		});
		const second = workspace.addQuestion({
			question: "Explique escalonamento preemptivo.",
			options: [],
			answers: ["Permite interrupcao do processo em execucao."],
			topic: "Escalonamento",
		});

		expect(first.questionId).toBe("q1");
		expect(second.questionId).toBe("q2");
		expect(workspace.listQuestions().map((item) => item.questionId)).toEqual([
			"q1",
			"q2",
		]);
	});

	it('forces explanation to "" and normalizes open-ended questions', () => {
		const workspace = createExtractionWorkspace();

		const added = workspace.addQuestion({
			question: "Explique o modelo OSI.",
			options: [],
			answers: ["O modelo OSI possui sete camadas."],
			explanation: "deve ser removida",
			topic: "Redes",
		});

		expect(added.explanation).toBe("");
		expect(added.options).toEqual([
			"O modelo OSI possui sete camadas.",
			"Resposta incorreta.",
		]);
	});

	it("updates an existing question and derives the final ingest result", () => {
		const workspace = createExtractionWorkspace();

		const added = workspace.addQuestion({
			question: "Questao original",
			options: ["A", "B"],
			answers: ["A"],
			topic: "Topico 1",
		});

		const updated = workspace.updateQuestion(added.questionId, {
			question: "Questao corrigida",
			topic: "Topico 2",
		});

		expect(updated.question).toBe("Questao corrigida");
		expect(updated.topic).toBe("Topico 2");

		const result = workspace.buildResult();
		expect(result).toEqual({
			examName: "Untitled exam",
			questions: [
				{
					question: "Questao corrigida",
					options: ["A", "B"],
					answers: ["A"],
					scoringMode: "exact",
					deepExplanation: undefined,
					explanation: "",
					topic: "Topico 2",
				},
			],
			topics: ["Topico 2"],
		});
	});

	it("rejects updates for an unknown question id", () => {
		const workspace = createExtractionWorkspace();

		expect(
			() =>
				workspace.updateQuestion("q999", {
					question: "Nao existe",
				}),
		).toThrowError(ExtractionWorkspaceError);
		expect(
			() =>
				workspace.updateQuestion("q999", {
					question: "Nao existe",
				}),
		).toThrowError(
			"Question q999 was not found in the current extraction workspace.",
		);
	});
});
