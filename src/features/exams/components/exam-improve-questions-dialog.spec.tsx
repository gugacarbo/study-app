import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExamImproveQuestionsDialog } from "@/features/exams/components/exam-improve-questions-dialog";

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
				writeExplanations: false,
				writeOptionExplanations: false,
			});
		});
		await waitFor(() => {
			expect(onOpenChange).toHaveBeenCalledWith(false);
		});
	});
});
