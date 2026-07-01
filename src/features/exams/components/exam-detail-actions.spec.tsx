import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExamDetailActions } from "@/features/exams/components/exam-detail-actions";

const navigate = vi.fn();
const mutateAsync = vi.fn();
const approveAllDrafts = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		Link: ({ children }: { children: ReactNode }) => <>{children}</>,
		useNavigate: () => navigate,
	};
});

vi.mock("@/features/quiz/hooks/use-active-attempt", () => ({
	useActiveAttempt: () => ({ data: null }),
}));

vi.mock("@/features/quiz/hooks/use-start-attempt", () => ({
	useStartAttempt: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
}));

vi.mock("@/features/exams/hooks/use-delete-exam", () => ({
	useDeleteExam: () => ({
		mutateAsync,
		isPending: false,
	}),
}));

describe("ExamDetailActions", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it("opens a confirmation dialog before deleting the exam", async () => {
		render(
			<ExamDetailActions
				examId="exam-1"
				examName="Prova 1"
				questions={[]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /excluir prova/i }));

		expect(screen.getByRole("alertdialog")).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /excluir prova/i }),
		).toBeInTheDocument();
		expect(
			screen.getByText(/essa ação remove a prova "prova 1" e não pode ser desfeita/i),
		).toBeInTheDocument();
		expect(mutateAsync).not.toHaveBeenCalled();
	});

	it("closes the dialog without deleting when canceled", async () => {
		render(
			<ExamDetailActions
				examId="exam-1"
				examName="Prova 1"
				questions={[]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /excluir prova/i }));
		fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

		await waitFor(() => {
			expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
		});
		expect(mutateAsync).not.toHaveBeenCalled();
	});

	it("deletes and navigates back to the exams list after confirmation", async () => {
		mutateAsync.mockResolvedValue({ success: true });

		render(
			<ExamDetailActions
				examId="exam-1"
				examName="Prova 1"
				questions={[]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /excluir prova/i }));
		fireEvent.click(screen.getByRole("button", { name: /excluir/i }));

		await waitFor(() => {
			expect(mutateAsync).toHaveBeenCalled();
		});
		expect(navigate).toHaveBeenCalledWith({ to: "/exams" });
	});

	it("opens a confirmation dialog before approving all draft improvements", async () => {
		render(
			<ExamDetailActions
				examId="exam-1"
				examName="Prova 1"
				questions={[]}
				pendingDraftCount={2}
				onApproveAllDrafts={approveAllDrafts}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /aprovar todas/i }));

		expect(screen.getByRole("alertdialog")).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /aprovar todas as melhorias/i }),
		).toBeInTheDocument();
		expect(
			screen.getByText(/isso vai aprovar 2 melhorias em draft na prova "prova 1"/i),
		).toBeInTheDocument();
		expect(approveAllDrafts).not.toHaveBeenCalled();
	});

	it("approves all draft improvements only after confirmation", async () => {
		approveAllDrafts.mockResolvedValue(undefined);

		render(
			<ExamDetailActions
				examId="exam-1"
				examName="Prova 1"
				questions={[]}
				pendingDraftCount={2}
				onApproveAllDrafts={approveAllDrafts}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /aprovar todas/i }));
		fireEvent.click(
			screen.getByRole("alertdialog").querySelector("button[data-slot='alert-dialog-action']") as HTMLButtonElement,
		);

		await waitFor(() => {
			expect(approveAllDrafts).toHaveBeenCalled();
		});
	});

	it("replaces improve with review improvement when a pending draft exists", async () => {
		render(
			<ExamDetailActions
				examId="exam-1"
				examName="Prova 1"
				questions={[
					{
						id: "q1",
						question: "Questão 1",
						options: [],
						answers: [],
						topic: "Tema",
						scoringMode: "exact",
						explanation: null,
						deepExplanation: null,
					},
				]}
				reviewImprovementQuestionId="q1"
			/>,
		);

		expect(
			screen.queryByRole("button", { name: /melhorar/i }),
		).not.toBeInTheDocument();

		fireEvent.click(
			screen.getByRole("button", { name: /revisar melhoria/i }),
		);

		await waitFor(() => {
			expect(navigate).toHaveBeenCalledWith({
				to: "/exams/$examId/questions/$questionId/edit",
				params: {
					examId: "exam-1",
					questionId: "q1",
				},
			});
		});
	});
});
