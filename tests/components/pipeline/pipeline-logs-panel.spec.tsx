import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PipelineLogsPanel } from "@/features/ai/pipeline/ui/pipeline-logs-panel";
import type { PipelineLogEntry } from "@/features/ai/pipeline/types";

const logs: PipelineLogEntry[] = [
	{
		level: "info",
		message: "Starting extraction",
		timestamp: 1,
		stageId: "extract",
	},
	{
		level: "warning",
		message: "Agent token stream",
		timestamp: 2,
		agentRunId: "extract-1",
	},
];

describe("PipelineLogsPanel", () => {
	beforeEach(() => {
		HTMLElement.prototype.scrollTo = vi.fn();
	});

	afterEach(() => {
		cleanup();
	});

	it("shows step text and process logs without agent-run noise", () => {
		render(
			<PipelineLogsPanel
				logs={logs}
				stepText="Parsing PDF"
			/>,
		);

		expect(screen.getByText("Parsing PDF")).toBeTruthy();
		expect(screen.getByText("Starting extraction")).toBeTruthy();
		expect(screen.queryByText("Agent token stream")).toBeNull();
	});

	it("filters logs by stage and clears the filter", () => {
		const onClearFilter = vi.fn();

		render(
			<PipelineLogsPanel
				logs={[
					...logs,
					{
						level: "info",
						message: "Review pass started",
						timestamp: 3,
						stageId: "review",
					},
				]}
				filteredStageId="review"
				filteredStageLabel="Review"
				onClearFilter={onClearFilter}
			/>,
		);

		expect(screen.getByText("Process: Review")).toBeTruthy();
		expect(screen.getByText("Review pass started")).toBeTruthy();
		expect(screen.queryByText("Starting extraction")).toBeNull();

		fireEvent.click(screen.getByText("Clear filter"));
		expect(onClearFilter).toHaveBeenCalledTimes(1);
	});

	it("shows an empty state when there are no process logs", () => {
		render(<PipelineLogsPanel logs={[]} />);
		expect(screen.getByText("No process logs yet")).toBeTruthy();
	});
});
