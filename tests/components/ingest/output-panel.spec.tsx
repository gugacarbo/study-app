import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import type { UIMessage } from "@tanstack/ai-client";
import type { IngestPipelineStageViewModel } from "@/features/ingest/components/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutputPanel } from "@/features/ingest/components/output-panel";

function buildTextMessage(
	id: string,
	role: UIMessage["role"],
	content: string,
): UIMessage {
	return {
		id,
		role,
		parts: [{ type: "text", content }],
	};
}

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
							{
								id: "assistant-1",
								role: "assistant",
								parts: [
									{ type: "text", content: "Inspecting the current question." },
									{
										type: "tool-call",
										id: "tc-1",
										name: "list_extracted_questions",
										arguments: "{}",
										input: {},
										state: "input-complete",
									},
									{
										type: "tool-result",
										toolCallId: "tc-1",
										content: '[{"id":"q1","question":"Qual é a derivada de f(x)=x²?"}]',
										state: "complete",
									},
								],
							},
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
		expect(document.body.textContent).toContain("Tool call: list_extracted_questions");
		expect(document.body.textContent).not.toContain("Agent Work");
		expect(document.body.textContent).not.toContain("(input complete)");
		expect(document.body.textContent).not.toContain("Tool result");
		fireEvent.click(
			screen.getByRole("button", {
				name: /Tool call: list_extracted_questions/i,
			}),
		);
		expect(screen.getByText(/Qual é a derivada/)).toBeTruthy();
	});

	it("keeps the open agent dialog in sync when the same agent receives new tool parts", () => {
		const baseAgent = {
			id: "review-1",
			stageId: "review",
			name: "Review question 1",
			state: "running" as const,
			messages: [
				buildTextMessage("system-1", "system", "review system prompt"),
				buildTextMessage("user-1", "user", "review user prompt"),
				{
					id: "assistant-1",
					role: "assistant" as const,
					parts: [{ type: "text" as const, content: "Inspecting q1." }],
				},
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
							{
								id: "assistant-1",
								role: "assistant",
								parts: [
									{ type: "text", content: "Inspecting q1." },
									{
										type: "tool-call",
										id: "tc-1",
										name: "update_extracted_question",
										arguments: '{"questionId":"q1"}',
										input: { questionId: "q1" },
										state: "input-complete",
									},
									{
										type: "tool-result",
										toolCallId: "tc-1",
										content: '{"ok":true}',
										state: "complete",
									},
								],
							},
						],
					},
				]}
				onClearFilter={() => {}}
			/>,
		);

		expect(document.body.textContent).toContain("Tool call: update_extracted_question");
		expect(document.body.textContent).not.toContain("Agent Work");
		expect(document.body.textContent).not.toContain("(input complete)");
		expect(document.body.textContent).not.toContain("Tool result");
		fireEvent.click(
			screen.getByRole("button", {
				name: /Tool call: update_extracted_question/i,
			}),
		);
		expect(screen.getByText(/"ok":\s*true/)).toBeTruthy();
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
				{
					id: "assistant-1",
					role: "assistant" as const,
					parts: [
						{
							type: "tool-call" as const,
							id: "tc-1",
							name: "add_extracted_question",
							arguments: '{"questionId":"q1"}',
							input: { questionId: "q1" },
							state: "input-complete" as const,
							output: '{"ok":true,"questionId":"q1"}',
						},
						{
							type: "tool-result" as const,
							toolCallId: "tc-1",
							content: '{"ok":true,"questionId":"q1"}',
							state: "complete" as const,
						},
						{
							type: "tool-call" as const,
							id: "tc-2",
							name: "add_extracted_question",
							arguments: '{"questionId":"q2"}',
							input: { questionId: "q2" },
							state: "input-streaming" as const,
						},
					],
				},
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

		expect(
			screen.getAllByRole("button", {
				name: /Tool call: add_extracted_question/i,
			}),
		).toHaveLength(2);

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
							{
								id: "assistant-1",
								role: "assistant",
								parts: [
									{
										type: "tool-call",
										id: "tc-1",
										name: "add_extracted_question",
										arguments: '{"questionId":"q1"}',
										input: { questionId: "q1" },
										state: "input-complete",
										output: '{"ok":true,"questionId":"q1"}',
									},
									{
										type: "tool-result",
										toolCallId: "tc-1",
										content: '{"ok":true,"questionId":"q1"}',
										state: "complete",
									},
									{
										type: "tool-call",
										id: "tc-2",
										name: "add_extracted_question",
										arguments: '{"questionId":"q2"}',
										input: { questionId: "q2" },
										state: "input-complete",
										output: '{"ok":true,"questionId":"q2"}',
									},
									{
										type: "tool-result",
										toolCallId: "tc-2",
										content: '{"ok":true,"questionId":"q2"}',
										state: "complete",
									},
								],
							},
						],
					},
				]}
				onClearFilter={() => {}}
			/>,
		);

		expect(
			screen.getAllByRole("button", {
				name: /Tool call: add_extracted_question/i,
			}),
		).toHaveLength(2);
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
							{
								id: "assistant-1",
								role: "assistant",
								parts: [
									{ type: "text", content: "Inspecting the current question." },
									{
										type: "tool-call",
										id: "tc-1",
										name: "list_extracted_questions",
										arguments: '{"questionId":"q1"}',
										input: { questionId: "q1" },
										state: "input-complete",
									},
									{
										type: "tool-result",
										toolCallId: "tc-1",
										content: '{"ok":true}',
										state: "complete",
									},
								],
							},
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
