import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImproveQuestionsProgressPanel } from "@/features/background-processes/components/improve-questions-progress-panel";
import { JOB_STATUS } from "@/lib/job-kinds";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		to,
		params,
		children,
		...props
	}: {
		to: string;
		params?: Record<string, string>;
		children: ReactNode;
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
});

describe("ImproveQuestionsProgressPanel", () => {
	it("limits the question lists to the remaining card height with compact cards", () => {
		render(
			<ImproveQuestionsProgressPanel
				status={JOB_STATUS.COMPLETED}
				error={null}
				isLoading={false}
				isJobLive={false}
				metadata={{
					examId: "exam-1",
					modelId: "model-1",
					writeExplanations: true,
					writeOptionExplanations: false,
					questionIds: ["q-1", "q-2"],
					concurrencyLimit: 1,
					totalCount: 2,
					queuedCount: 0,
					runningCount: 0,
					completedCount: 2,
					failedCount: 0,
					cancelledCount: 0,
					pendingReviewCount: 2,
					items: [
						{
							questionId: "q-1",
							questionNumber: 1,
							status: "completed",
							stage: "saving_draft",
						},
						{
							questionId: "q-2",
							questionNumber: 2,
							status: "completed",
							stage: "saving_draft",
						},
					],
				}}
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
						{
							questionId: "q-2",
							questionNumber: 2,
							status: "completed",
							stage: "saving_draft",
							warnings: ["Revisar alternativa A."],
							messages: [],
							events: [],
							lastSeq: 0,
						},
					],
				}}
			/>,
		);

		const mobileList = screen.getByLabelText("Lista de questões no mobile");
		expect(mobileList).toHaveClass("min-h-40", "flex-1", "overflow-hidden", "md:hidden");
		expect(
			screen.getByRole("button", { name: /questões.*2 draft\(s\) pendente\(s\)/i }),
		).toBeInTheDocument();

		const desktopList = screen.getByLabelText("Lista de questões no desktop");
		expect(desktopList).toHaveClass(
			"hidden",
			"min-h-40",
			"flex-1",
			"overflow-y-auto",
			"md:block",
		);

		const desktopItem = desktopList.querySelector("li");
		expect(desktopItem).toHaveClass("px-2.5", "py-2");

		expect(screen.getAllByText(/questão 1/i).length).toBeGreaterThan(0);
		expect(screen.getAllByText(/etapa atual:\s*salvando draft/i).length).toBeGreaterThan(0);
	});

	it("renders job counters as an icon text list instead of metric cards", () => {
		render(
			<ImproveQuestionsProgressPanel
				status={JOB_STATUS.RUNNING}
				error={null}
				isLoading={false}
				isJobLive={true}
				metadata={{
					examId: "exam-1",
					modelId: "model-1",
					writeExplanations: true,
					writeOptionExplanations: false,
					questionIds: ["q-1"],
					concurrencyLimit: 1,
					totalCount: 1,
					queuedCount: 2,
					runningCount: 1,
					completedCount: 8,
					failedCount: 3,
					cancelledCount: 0,
					pendingReviewCount: 1,
					items: [
						{
							questionId: "q-1",
							questionNumber: 1,
							status: "running",
							stage: "drafting",
						},
					],
				}}
				monitor={{
					batchPhase: "processing_questions",
					questions: [
						{
							questionId: "q-1",
							questionNumber: 1,
							status: "running",
							stage: "drafting",
							warnings: [],
							messages: [],
							events: [],
							lastSeq: 0,
						},
					],
				}}
			/>,
		);

		const counters = screen.getByLabelText("Resumo do andamento das questões");
		expect(counters).toHaveClass("flex", "flex-wrap", "gap-x-4", "gap-y-2");
		expect(counters.querySelector(".grid")).toBeNull();
		expect(counters).toHaveTextContent(/na fila\s*2/i);
		expect(counters).toHaveTextContent(/em execução\s*1/i);
		expect(counters).toHaveTextContent(/concluídas\s*8/i);
		expect(counters).toHaveTextContent(/falhas\s*3/i);
	});

	it("shows the live pending draft count from completed questions while the job is still running", () => {
		render(
			<ImproveQuestionsProgressPanel
				status={JOB_STATUS.RUNNING}
				error={null}
				isLoading={false}
				isJobLive={true}
				metadata={{
					examId: "exam-1",
					modelId: "model-1",
					writeExplanations: true,
					writeOptionExplanations: false,
					questionIds: ["q-1", "q-2"],
					concurrencyLimit: 1,
					totalCount: 2,
					queuedCount: 0,
					runningCount: 1,
					completedCount: 1,
					failedCount: 0,
					cancelledCount: 0,
					pendingReviewCount: 0,
					items: [
						{
							questionId: "q-1",
							questionNumber: 1,
							status: "completed",
							stage: "saving_draft",
						},
						{
							questionId: "q-2",
							questionNumber: 2,
							status: "running",
							stage: "writing_explanations",
						},
					],
				}}
				monitor={{
					batchPhase: "processing_questions",
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
						{
							questionId: "q-2",
							questionNumber: 2,
							status: "running",
							stage: "writing_explanations",
							warnings: [],
							messages: [],
							events: [],
							lastSeq: 0,
						},
					],
				}}
			/>,
		);

		expect(
			screen.getByRole("button", { name: /questões.*1 draft\(s\) pendente\(s\)/i }),
		).toBeInTheDocument();
	});
});
