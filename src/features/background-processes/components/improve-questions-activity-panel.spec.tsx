import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ImproveQuestionsActivityPanel } from "@/features/background-processes/components/improve-questions-activity-panel";
import { JOB_STATUS } from "@/lib/job-kinds";

afterEach(() => {
	cleanup();
});

describe("ImproveQuestionsActivityPanel", () => {
	it("hides the stage label in the trigger when the question is completed", () => {
		render(
			<ImproveQuestionsActivityPanel
				status={JOB_STATUS.COMPLETED}
				monitor={{
					batchPhase: "finalizing_batch",
					questions: [
						{
							questionId: "q-1",
							questionNumber: 1,
							status: "completed",
							stage: "saving_draft",
							warnings: [],
							messages: [],
							events: [],
							lastSeq: 0,
						},
					],
				}}
			/>,
		);

		const trigger = screen.getByRole("button", { name: /questão 1/i });
		expect(trigger).toHaveTextContent(/questão 1/i);
		expect(trigger).toHaveTextContent(/completed/i);
		expect(trigger).not.toHaveTextContent(/salvando draft/i);
	});

	it("starts collapsed even for running agents and only renders details after manual open", () => {
		render(
			<ImproveQuestionsActivityPanel
				status={JOB_STATUS.RUNNING}
				monitor={{
					batchPhase: "processing_questions",
					questions: [
						{
							questionId: "q-1",
							questionNumber: 1,
							status: "running",
							stage: "drafting",
							warnings: ["Revisar a alternativa B."],
							messages: [],
							events: [],
							lastSeq: 0,
						},
					],
				}}
			/>,
		);

		const trigger = screen.getByRole("button", { name: /questão 1/i });
		expect(trigger).toHaveAttribute("data-state", "closed");
		expect(screen.queryByText(/alertas/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/revisar a alternativa b\./i)).not.toBeInTheDocument();

		fireEvent.click(trigger);

		expect(trigger).toHaveAttribute("data-state", "open");
		expect(screen.getByText(/alertas/i)).toBeInTheDocument();
		expect(screen.getByText(/revisar a alternativa b\./i)).toBeInTheDocument();
	});
});
