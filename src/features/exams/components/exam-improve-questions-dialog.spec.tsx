import React from "react";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExamImproveQuestionsDialog } from "@/features/exams/components/exam-improve-questions-dialog";
import { IMPROVE_QUESTIONS_DEFAULT_CONCURRENCY } from "@/lib/job-kinds";

const submit = vi.fn();
const onOpenChange = vi.fn();

const improveJobState = {
	submit,
	isPending: false,
	error: null as string | null,
	conflict: null as {
		message: string;
		jobId: string;
		examId: string;
		reason: "active_job" | "pending_review";
	} | null,
};

vi.mock("@/features/exams/hooks/use-improve-questions-job", () => ({
	useImproveQuestionsJob: () => improveJobState,
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		to,
		params,
		children,
		...props
	}: {
		to: string;
		params?: Record<string, string>;
		children: React.ReactNode;
	}) => {
		let href = to;
		if (params) {
			for (const [key, value] of Object.entries(params)) {
				href = href.replace(`$${key}`, value);
			}
		}
		return (
			<a href={href} {...props}>
				{children}
			</a>
		);
	},
}));

afterEach(() => {
	cleanup();
	improveJobState.conflict = null;
	improveJobState.error = null;
	improveJobState.isPending = false;
});

describe("ExamImproveQuestionsDialog", () => {
	it("keeps the dialog open and renders conflict actions when a blocked flow is found", async () => {
		submit.mockReset();
		onOpenChange.mockReset();
		improveJobState.conflict = {
			message: "Já existe um processo aguardando aprovação.",
			jobId: "job-1",
			examId: "exam-1",
			reason: "pending_review",
		};
		submit.mockResolvedValue(false);

		render(
			<ExamImproveQuestionsDialog
				examId="exam-1"
				open
				onOpenChange={onOpenChange}
				questions={[
					{
						id: "q-1",
						question: "Qual a capital do Brasil?",
						topic: "Geografia",
					} as never,
				]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /iniciar melhoria/i }));

		await waitFor(() => {
			expect(submit).toHaveBeenCalled();
		});
		expect(onOpenChange).not.toHaveBeenCalledWith(false);
		expect(
			screen.getByText(/já existe um processo aguardando aprovação/i),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /ir para o job/i }),
		).toHaveAttribute("href", "/jobs/job-1");
		expect(
			screen.getByRole("link", { name: /ir para as questões/i }),
		).toHaveAttribute("href", "/exams/exam-1");
	});

	it("submits writeExplanations as false by default", async () => {
		submit.mockReset();
		onOpenChange.mockReset();
		improveJobState.conflict = null;
		submit.mockResolvedValue(true);

		render(
			<ExamImproveQuestionsDialog
				examId="exam-1"
				open
				onOpenChange={onOpenChange}
				questions={[
					{
						id: "q-1",
						question: "Qual a capital do Brasil?",
						topic: "Geografia",
					} as never,
				]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /iniciar melhoria/i }));

		await waitFor(() => {
			expect(submit).toHaveBeenCalledWith({
				examId: "exam-1",
				questionIds: ["q-1"],
				concurrencyLimit: IMPROVE_QUESTIONS_DEFAULT_CONCURRENCY,
				writeExplanations: false,
				writeOptionExplanations: false,
			});
		});
		await waitFor(() => {
			expect(onOpenChange).toHaveBeenCalledWith(false);
		});
	});

	it("allows clearing every selected question without auto-restoring the full list", async () => {
		submit.mockReset();
		onOpenChange.mockReset();
		improveJobState.conflict = null;

		render(
			<ExamImproveQuestionsDialog
				examId="exam-1"
				open
				onOpenChange={onOpenChange}
				questions={[
					{
						id: "q-1",
						question: "Qual a capital do Brasil?",
						topic: "Geografia",
					} as never,
				]}
			/>,
		);

		expect(screen.getByText(/1 de 1 selecionada\(s\)/i)).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /desmarcar/i }));

		expect(screen.getByText(/0 de 1 selecionada\(s\)/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /iniciar melhoria/i }),
		).toBeDisabled();
		expect(
			screen.getByRole("button", { name: /selecionar/i }),
		).toBeInTheDocument();
	});

	it("submits the configured concurrency limit", async () => {
		submit.mockReset();
		onOpenChange.mockReset();
		improveJobState.conflict = null;
		submit.mockResolvedValue(true);

		render(
			<ExamImproveQuestionsDialog
				examId="exam-1"
				open
				onOpenChange={onOpenChange}
				questions={[
					{
						id: "q-1",
						question: "Qual a capital do Brasil?",
						topic: "Geografia",
					} as never,
				]}
			/>,
		);

		fireEvent.change(screen.getByLabelText(/máximo de tarefas em paralelo/i), {
			target: { value: "4" },
		});
		fireEvent.click(screen.getByRole("button", { name: /iniciar melhoria/i }));

		await waitFor(() => {
			expect(submit).toHaveBeenCalledWith({
				examId: "exam-1",
				questionIds: ["q-1"],
				concurrencyLimit: 4,
				writeExplanations: false,
				writeOptionExplanations: false,
			});
		});
	});
});
