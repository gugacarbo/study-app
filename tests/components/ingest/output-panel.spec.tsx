import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OutputPanel } from "@/components/ingest/output-panel";

describe("OutputPanel", () => {
	it("opens the agent detail dialog when clicking an ingest agent card", () => {
		render(
			<OutputPanel
				entries={[]}
				rawOutput=""
				rawStreamText=""
				tokenTotals={{ prompt: 0, completion: 0, total: 0 }}
				selectedStageId={null}
				selectedStageLabel={null}
				agents={[
					{
						id: "review-1",
						stageId: "review",
						name: "Review question 1",
						state: "running",
						summary: "Reviewer summary",
						systemPrompt: "review system prompt",
						userPrompt: "review user prompt",
						response: "review response",
					},
				]}
				onClearFilter={() => {}}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", { name: /Review question 1/i }),
		);

		expect(
			screen.getByRole("heading", { name: "Review question 1" }),
		).toBeTruthy();
		expect(document.body.textContent).toContain("review system prompt");
		expect(document.body.textContent).toContain("review user prompt");
		expect(document.body.textContent).toContain("review response");
	});
});
