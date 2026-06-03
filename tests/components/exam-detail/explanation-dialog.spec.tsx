import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExplanationDialog } from "@/features/exams/components/detail/explanation-dialog";
import { Dialog } from "@/components/ui/dialog";
import type { ExplanationAgentRunSummary } from "@/features/ai/agents/explanations";
import { useExplanationGeneration } from "@/features/ai/components/exam-detail/explanation-generation";

vi.mock("@/features/ai/components/exam-detail/explanation-generation", () => ({
	useExplanationGeneration: vi.fn(),
}));

const mockedUseExplanationGeneration = vi.mocked(useExplanationGeneration);

describe("ExplanationDialog", () => {
	beforeEach(() => {
		mockedUseExplanationGeneration.mockReset();
	});

	function mockGenerationState() {
		const agentRun: ExplanationAgentRunSummary = {
			agentRunId: "explanations-batch-1",
			label: "Explanation batch 1",
			status: "done",
			systemPrompt: "prompt de sistema",
			userPrompt: "prompt do usuario",
			rawText: "resposta final do agente",
			meta: {
				questionCount: 1,
				questionIds: [1],
			},
		};

		mockedUseExplanationGeneration.mockReturnValue({
			generatingExplanations: false,
			overwriteExplanations: false,
			setOverwriteExplanations: vi.fn(),
			batchSize: 8,
			setBatchSize: vi.fn(),
			generationMessage: null,
			progressItems: [
				{
					id: 1,
					question: "Pergunta 1",
					status: "done",
					message: "Concluida",
					response: {
						explanation: "explicacao curta",
						deepExplanation: "explicacao longa",
						agentRun,
					},
				},
			],
			selectedResponseItemId: 1,
			setSelectedResponseItemId: vi.fn(),
			pendingExplanationCount: 1,
			questionOrder: new Map([[1, 1]]),
			processingCount: 0,
			doneCount: 1,
			errorCount: 0,
			finishedCount: 1,
			progressPercent: 100,
			findAgentRunForQuestionId: vi.fn((questionId: number) =>
				questionId === 1 ? agentRun : undefined,
			),
			selectedResponseItem: {
				id: 1,
				question: "Pergunta 1",
				status: "done",
				message: "Concluida",
				response: {
					explanation: "explicacao curta",
					deepExplanation: "explicacao longa",
					agentRun,
				},
			},
			agentRuns: [agentRun],
			handleGenerateExplanations: vi.fn(),
		});

		return agentRun;
	}

	function mockProcessingGenerationState() {
		const agentRun: ExplanationAgentRunSummary = {
			agentRunId: "explanations-batch-1:explanation-batch-1",
			label: "Explanation batch 1",
			status: "running",
			systemPrompt: "",
			userPrompt: "",
			meta: {
				questionCount: 1,
				questionIds: [1],
			},
		};

		mockedUseExplanationGeneration.mockReturnValue({
			generatingExplanations: true,
			overwriteExplanations: false,
			setOverwriteExplanations: vi.fn(),
			batchSize: 8,
			setBatchSize: vi.fn(),
			generationMessage: null,
			progressItems: [
				{
					id: 1,
					question: "Pergunta 1",
					status: "processing",
					message: "Gerando...",
				},
			],
			selectedResponseItemId: null,
			setSelectedResponseItemId: vi.fn(),
			pendingExplanationCount: 1,
			questionOrder: new Map([[1, 1]]),
			processingCount: 1,
			doneCount: 0,
			errorCount: 0,
			finishedCount: 0,
			progressPercent: 0,
			findAgentRunForQuestionId: vi.fn((questionId: number) =>
				questionId === 1 ? agentRun : undefined,
			),
			selectedResponseItem: undefined,
			agentRuns: [agentRun],
			handleGenerateExplanations: vi.fn(),
		});
	}

	function renderDialog() {
		render(
			<Dialog open>
				<ExplanationDialog
					open
					examId={1}
					questions={[
						{
							id: 1,
							question: "Pergunta 1",
							explanation: "",
							deepExplanation: "",
						},
					]}
					questionCount={1}
				/>
			</Dialog>,
		);
	}

	it("opens the shared agent detail dialog when clicking a question progress card", () => {
		mockGenerationState();

		renderDialog();

		fireEvent.click(screen.getByRole("button", { name: /Q1 · Pergunta 1/i }));

		expect(screen.getByRole("heading", { name: "Explanation batch 1" })).toBeTruthy();
		expect(document.body.textContent).toContain("prompt de sistema");
		expect(document.body.textContent).toContain("prompt do usuario");
		expect(document.body.textContent).toContain("resposta final do agente");
	});

	it("opens the shared agent detail dialog when clicking an explanation agent card", () => {
		mockGenerationState();

		renderDialog();

		fireEvent.click(
			screen.getAllByRole("button", { name: /Explanation batch 1/i })[0],
		);

		expect(screen.getByRole("heading", { name: "Explanation batch 1" })).toBeTruthy();
		expect(document.body.textContent).toContain("prompt de sistema");
		expect(document.body.textContent).toContain("prompt do usuario");
		expect(document.body.textContent).toContain("resposta final do agente");
	});

	it("opens the shared agent detail dialog when clicking a processing question card", () => {
		mockProcessingGenerationState();

		renderDialog();

		fireEvent.click(screen.getByRole("button", { name: /Q1 · Pergunta 1/i }));

		expect(screen.getByRole("heading", { name: "Explanation batch 1" })).toBeTruthy();
	});
});
