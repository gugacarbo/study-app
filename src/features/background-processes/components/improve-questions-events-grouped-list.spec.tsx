import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImproveQuestionsEventsGroupedList } from "@/features/background-processes/components/improve-questions-events-grouped-list";
import { JOB_STATUS } from "@/lib/job-kinds";

describe("ImproveQuestionsEventsGroupedList", () => {
	it("keeps the grouped event list inside its own scroll container", () => {
		render(
			<ImproveQuestionsEventsGroupedList
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
							events: [
								{
									seq: 1,
									payload: { type: "text", text: "Executando melhoria" },
									createdAt: null,
								},
							],
							lastSeq: 1,
						},
					],
				}}
				events={[
					{
						seq: 1,
						payload: { type: "text", text: "Executando melhoria" },
						createdAt: null,
					},
					{
						seq: 2,
						payload: {
							type: "data-improve-batch-phase",
							data: { phase: "processing_questions" },
						},
						createdAt: null,
					},
				]}
				status={JOB_STATUS.RUNNING}
				isLoading={false}
				error={null}
			/>,
		);

		const container = screen.getByLabelText("Lista de eventos do job de melhoria");
		expect(container).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
		expect(screen.getByRole("button", { name: /questão 1/i })).toBeInTheDocument();
	});
});
