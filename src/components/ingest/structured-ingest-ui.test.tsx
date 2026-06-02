import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LogsPanel } from "./LogsPanel";
import { OutputPanel } from "./OutputPanel";
import type {
	IngestAgentRunViewModel,
	IngestLogEntry,
	IngestOutputEntry,
	IngestTokenTotals,
} from "./types";

const tokenTotals: IngestTokenTotals = {
	prompt: 120,
	completion: 42,
	total: 162,
};

const outputEntries: IngestOutputEntry[] = [
	{
		id: "decode-output",
		kind: "message",
		stageId: "decode",
		role: "assistant",
		content: "Decoded file contents",
	},
	{
		id: "review-output",
		kind: "message",
		stageId: "review",
		role: "assistant",
		content: "Reviewer found a missing cardiology topic",
	},
];

const agents: IngestAgentRunViewModel[] = [
	{
		id: "reviewer-a",
		stageId: "review",
		name: "Coverage reviewer",
		state: "running",
		summary: "Checking missing topics",
		systemPrompt: "Use web tools when evidence is weak.",
		userPrompt: "Verify whether the extraction covers all high-yield topics.",
		response: "Coverage is incomplete; add cardiology and endocrine follow-up.",
		raw: {
			payload: { runId: "reviewer-a" },
			stream: [{ event: "delta", text: "Coverage is incomplete" }],
			status: { phase: "streaming" },
			tokens: { total: 88 },
		},
	},
];

describe("OutputPanel", () => {
	afterEach(() => {
		cleanup();
	});

	it("filters treated output by stage and shows agent details", () => {
		render(
			<OutputPanel
				entries={outputEntries}
				rawOutput={"Decoded file contents\nReviewer found a missing topic"}
				tokenTotals={tokenTotals}
				isRunning
				selectedStageId="review"
				selectedStageLabel="Review"
				agents={agents}
				onClearFilter={() => {}}
			/>,
		);

		expect(
			screen.getByText("Reviewer found a missing cardiology topic"),
		).toBeTruthy();
		expect(screen.queryByText("Decoded file contents")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: /coverage reviewer/i }));

		expect(
			screen.getByText("Use web tools when evidence is weak."),
		).toBeTruthy();
		expect(
			screen.getByText(
				"Coverage is incomplete; add cardiology and endocrine follow-up.",
			),
		).toBeTruthy();

		const dialog = document.querySelector('[role="dialog"]');
		expect(dialog).toBeTruthy();
		fireEvent.click(
			within(dialog as HTMLElement).getByRole("tab", { name: "Raw" }),
		);
		expect(dialog?.textContent).toContain('"runId": "reviewer-a"');
	});
});

describe("LogsPanel", () => {
	afterEach(() => {
		cleanup();
	});

	it("filters logs by structured stage id instead of stage label text", () => {
		const logs: IngestLogEntry[] = [
			{
				id: "review-log",
				stageId: "review",
				level: "info",
				message: "Starting reviewer agent",
			},
			{
				id: "persist-log",
				stageId: "persist",
				level: "info",
				message: "Review summary persisted to D1",
			},
		];

		const { container } = render(
			<LogsPanel
				logs={logs}
				filteredStageId="review"
				filteredStageLabel="Review"
				onClearFilter={() => {}}
			/>,
		);

		expect(container.textContent).toContain("Starting reviewer agent");
		expect(container.textContent).not.toContain(
			"Review summary persisted to D1",
		);
	});
});
