import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImproveQuestionsActivityPanel } from "@/features/background-processes/components/improve-questions-activity-panel";
import { JOB_STATUS } from "@/lib/job-kinds";

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
});
