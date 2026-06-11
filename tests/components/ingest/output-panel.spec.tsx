import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import type { IngestPipelineStageViewModel } from "@/features/ingest/components/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutputPanel } from "@/features/ingest/components/output-panel";
import {
	buildAssistantMessage,
	buildDynamicToolPart,
	buildTextMessage,
} from "./ui-message-fixtures";

const stages: IngestPipelineStageViewModel[] = [
	{
		stageId: "review",
		label: "Review",
		status: "running",
		timestamp: 20,
	},
];

describe("OutputPanel", () => {
	beforeEach(() => {
		HTMLElement.prototype.scrollTo = vi.fn();
	});

	afterEach(() => {
		cleanup();
	});

	it("opens an individual agent dialog with structured messages and tool parts", () => {
		render(
			<OutputPanel
				jobId="job-1"
				entries={[]}
				rawOutput=""
				rawStreamText=""
				tokenTotals={{ prompt: 0, completion: 0, total: 0 }}
				stages={stages}
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
						tokens: { prompt: 500, completion: 200, total: 700 },
						messages: [
							buildTextMessage(
								"system-1",
								"system",
								"Use tools to inspect and update the question.",
							),
							buildTextMessage(
								"user-1",
								"user",
								"Review q1 and fix the alternatives if needed.",
							),
							buildAssistantMessage([
								{ type: "text", text: "Inspecting the current question." },
								buildDynamicToolPart({
									toolCallId: "tc-1",
									toolName: "list_extracted_questions",
									state: "output-available",
									input: {},
									output: [
										{ id: "q1", question: "Qual é a derivada de f(x)=x²?" },
									],
								}),
							]),
						],
					},
				]}
				onClearFilter={() => {}}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", { name: /Review question 1/i }),
		);

		const dialog = screen.getByRole("dialog");
		expect(dialog).toBeTruthy();
		expect(
			within(dialog).getByText(/Tokens: 700/),
		).toBeTruthy();
		expect(
			screen.getByText("Use tools to inspect and update the question."),
		).toBeTruthy();
		expect(
			screen.getByText("Review q1 and fix the alternatives if needed."),
		).toBeTruthy();
		expect(
			screen.getByText("Inspecting the current question."),
		).toBeTruthy();
		expect(document.body.textContent).toContain("tool call");
		expect(document.body.textContent).not.toContain("Agent Work");
	});

	it("keeps the open agent dialog in sync when the same agent receives new tool parts", async () => {
		const baseAgent = {
			id: "review-1",
			stageId: "review",
			name: "Review question 1",
			state: "running" as const,
			messages: [
				buildTextMessage("system-1", "system", "review system prompt"),
				buildTextMessage("user-1", "user", "review user prompt"),
				buildAssistantMessage([{ type: "text", text: "Inspecting q1." }]),
			],
		};

		const { rerender } = render(
			<OutputPanel
				jobId="job-1"
				entries={[]}
				rawOutput=""
				rawStreamText=""
				tokenTotals={{ prompt: 0, completion: 0, total: 0 }}
				stages={stages}
				selectedStageId={null}
				selectedStageLabel={null}
				agents={[baseAgent]}
				onClearFilter={() => {}}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", { name: /Review question 1/i }),
		);

		rerender(
			<OutputPanel
				jobId="job-1"
				entries={[]}
				rawOutput=""
				rawStreamText=""
				tokenTotals={{ prompt: 0, completion: 0, total: 0 }}
				stages={stages}
				selectedStageId={null}
				selectedStageLabel={null}
				agents={[
					{
						...baseAgent,
						messages: [
							buildTextMessage("system-1", "system", "review system prompt"),
							buildTextMessage("user-1", "user", "review user prompt"),
							buildAssistantMessage([
								{ type: "text", text: "Inspecting q1." },
								buildDynamicToolPart({
									toolCallId: "tc-1",
									toolName: "update_extracted_question",
									state: "output-available",
									input: { questionId: "q1" },
									output: { ok: true },
								}),
							]),
						],
					},
				]}
				onClearFilter={() => {}}
			/>,
		);

		await waitFor(() => {
			expect(document.body.textContent).toContain("tool call");
		});
		expect(document.body.textContent).not.toContain("Agent Work");
	});

	it("shows completed and in-progress consecutive tool calls independently while running", () => {
		const baseAgent = {
			id: "extract-1",
			stageId: "initial_extraction",
			name: "Initial extraction agent",
			state: "running" as const,
			messages: [
				buildTextMessage("system-1", "system", "extract system prompt"),
				buildTextMessage("user-1", "user", "extract user prompt"),
				buildAssistantMessage([
					buildDynamicToolPart({
						toolCallId: "tc-1",
						toolName: "add_extracted_question",
						state: "output-available",
						input: { questionId: "q1" },
						output: { ok: true, questionId: "q1" },
					}),
					buildDynamicToolPart({
						toolCallId: "tc-2",
						toolName: "add_extracted_question",
						state: "input-streaming",
						input: { questionId: "q2" },
					}),
				]),
			],
		};

		const { rerender } = render(
			<OutputPanel
				jobId="job-1"
				entries={[]}
				rawOutput=""
				rawStreamText=""
				tokenTotals={{ prompt: 0, completion: 0, total: 0 }}
				stages={stages}
				selectedStageId={null}
				selectedStageLabel={null}
				agents={[baseAgent]}
				onClearFilter={() => {}}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", { name: /Initial extraction agent/i }),
		);

		expect(document.body.textContent).toContain("tool call");

		rerender(
			<OutputPanel
				jobId="job-1"
				entries={[]}
				rawOutput=""
				rawStreamText=""
				tokenTotals={{ prompt: 0, completion: 0, total: 0 }}
				stages={stages}
				selectedStageId={null}
				selectedStageLabel={null}
				agents={[
					{
						...baseAgent,
						messages: [
							buildTextMessage("system-1", "system", "extract system prompt"),
							buildTextMessage("user-1", "user", "extract user prompt"),
							buildAssistantMessage([
								buildDynamicToolPart({
									toolCallId: "tc-1",
									toolName: "add_extracted_question",
									state: "output-available",
									input: { questionId: "q1" },
									output: { ok: true, questionId: "q1" },
								}),
								buildDynamicToolPart({
									toolCallId: "tc-2",
									toolName: "add_extracted_question",
									state: "output-available",
									input: { questionId: "q2" },
									output: { ok: true, questionId: "q2" },
								}),
							]),
						],
					},
				]}
				onClearFilter={() => {}}
			/>,
		);

		expect(document.body.textContent).toContain("tool call");
		expect(document.body.textContent).not.toContain("Agent Work");
	});

	it("shows structured tool usage in the raw tab inside the agent dialog", () => {
		render(
			<OutputPanel
				jobId="job-1"
				entries={[]}
				rawOutput=""
				rawStreamText=""
				tokenTotals={{ prompt: 0, completion: 0, total: 0 }}
				stages={stages}
				selectedStageId={null}
				selectedStageLabel={null}
				agents={[
					{
						id: "review-1",
						stageId: "review",
						name: "Review question 1",
						state: "running",
						raw: {
							stream: "assistant chunk only",
							meta: { source: "ingest" },
						},
						messages: [
							buildTextMessage("system-1", "system", "review system prompt"),
							buildTextMessage("user-1", "user", "review user prompt"),
							buildAssistantMessage([
								{ type: "text", text: "Inspecting the current question." },
								buildDynamicToolPart({
									toolCallId: "tc-1",
									toolName: "list_extracted_questions",
									state: "output-available",
									input: { questionId: "q1" },
									output: { ok: true },
								}),
							]),
						],
					},
				]}
				onClearFilter={() => {}}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", { name: /Review question 1/i }),
		);
		fireEvent.click(within(screen.getByRole("dialog")).getByRole("tab", { name: "Raw" }));

		expect(document.body.textContent).toContain("[ASSISTANT]");
		expect(document.body.textContent).toContain(
			"TOOL CALL: list_extracted_questions",
		);
		expect(document.body.textContent).toContain("TOOL RESULT (tc-1):");
	});

	it("shows debug json from the raw tab inside the agent dialog", () => {
		render(
			<OutputPanel
				jobId="job-1"
				entries={[]}
				rawOutput=""
				rawStreamText=""
				tokenTotals={{ prompt: 0, completion: 0, total: 0 }}
				stages={stages}
				selectedStageId={null}
				selectedStageLabel={null}
				agents={[
					{
						id: "review-1",
						stageId: "review",
						name: "Review question 1",
						state: "running",
						raw: {
							stream: "assistant chunk only",
							meta: { source: "ingest" },
						},
						messages: [
							buildTextMessage("system-1", "system", "review system prompt"),
							buildTextMessage("user-1", "user", "review user prompt"),
							buildTextMessage("assistant-1", "assistant", "Inspecting q1."),
						],
					},
				]}
				onClearFilter={() => {}}
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", { name: /Review question 1/i }),
		);
		const dialog = screen.getByRole("dialog");
		fireEvent.click(within(dialog).getByRole("tab", { name: "Raw" }));
		fireEvent.click(within(dialog).getByRole("button", { name: "Debug JSON" }));

		expect(document.body.textContent).toContain('"source": "ingest"');
	});

	it("shows input and output token breakdown on badge hover in the Agents header", async () => {
		const tokenTotals = { prompt: 1200, completion: 800, total: 2000 };

		const { container } = render(
			<OutputPanel
				jobId="job-1"
				entries={[]}
				rawOutput=""
				rawStreamText=""
				tokenTotals={tokenTotals}
				stages={stages}
				selectedStageId={null}
				selectedStageLabel={null}
				agents={[]}
				onClearFilter={() => {}}
			/>,
		);

		const trigger = container.querySelector('[data-slot="popover-trigger"]');
		expect(trigger).toBeTruthy();
		fireEvent.mouseEnter(trigger as Element);

		expect(
			await screen.findByText(
				`Input: ${tokenTotals.prompt.toLocaleString()}`,
			),
		).toBeTruthy();
		expect(
			screen.getByText(`Output: ${tokenTotals.completion.toLocaleString()}`),
		).toBeTruthy();
		expect(screen.getByText("Agents")).toBeTruthy();
	});

	it("renders agent cards without a global raw tab in the output panel", () => {
		const { container } = render(
			<OutputPanel
				jobId="job-1"
				entries={[]}
				rawOutput=""
				rawStreamText=""
				tokenTotals={{ prompt: 0, completion: 0, total: 0 }}
				stages={stages}
				selectedStageId={null}
				selectedStageLabel={null}
				agents={[]}
				onClearFilter={() => {}}
			/>,
		);

		expect(
			within(container).queryByRole("tab", { name: "Raw" }),
		).toBeNull();
	});
});
