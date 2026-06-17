import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IngestChatView } from "@/features/ingest/components/ingest-chat-view";
import type {
	IngestAgentRunViewModel,
	IngestPipelineStageViewModel,
} from "@/features/ingest/components/types";
import {
	buildAssistantMessage,
	buildDynamicToolPart,
	buildTextMessage,
} from "./ui-message-fixtures";

const requestAnimationFrameSpy = vi
	.spyOn(window, "requestAnimationFrame")
	.mockImplementation((callback: FrameRequestCallback) => {
		setTimeout(() => callback(performance.now()), 0);
		return 1;
	});

function buildAgentRun(
	overrides: Partial<IngestAgentRunViewModel> = {},
): IngestAgentRunViewModel {
	return {
		id: "agent-1",
		stageId: "extract",
		name: "Extraction Agent",
		state: "success",
		startedAt: 10,
		messages: [],
		...overrides,
	};
}

const stages: IngestPipelineStageViewModel[] = [
	{
		stageId: "extract",
		label: "Extraction",
		status: "done",
		timestamp: 10,
	},
	{
		stageId: "review",
		label: "Review",
		status: "running",
		timestamp: 20,
	},
];

beforeEach(() => {
	requestAnimationFrameSpy.mockClear();
	HTMLElement.prototype.scrollTo = vi.fn();
});

describe("IngestChatView", () => {
	it("renders grouped stage separators and real chat message components from UI messages", () => {
		render(
			<IngestChatView
				selectedStageId={null}
				stages={stages}
				agents={[
					buildAgentRun({
						messages: [
							buildTextMessage(
								"system-1",
								"system",
								"Follow the extraction constraints.",
							),
							buildTextMessage("user-1", "user", "Parse this exam PDF."),
							buildTextMessage(
								"assistant-1",
								"assistant",
								"Extracted 14 candidate questions.",
							),
						],
					}),
				]}
			/>,
		);

		expect(screen.getByText("Extraction")).toBeTruthy();
		expect(screen.getAllByText("Done").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Extraction Agent").length).toBe(3);
		expect(
			screen.getByText("Follow the extraction constraints."),
		).toBeTruthy();
		expect(screen.getByText("Parse this exam PDF.")).toBeTruthy();
		expect(
			screen.getByText("Extracted 14 candidate questions."),
		).toBeTruthy();
	});

	it("falls back to legacy prompt and response fields when messages are not available yet", () => {
		render(
			<IngestChatView
				selectedStageId={null}
				stages={stages}
				agents={[
					buildAgentRun({
						systemPrompt: "Legacy system prompt",
						userPrompt: "Legacy user prompt",
						response: "Legacy assistant response",
					}),
				]}
			/>,
		);

		expect(screen.getByText("Legacy system prompt")).toBeTruthy();
		expect(screen.getByText("Legacy user prompt")).toBeTruthy();
		expect(screen.getByText("Legacy assistant response")).toBeTruthy();
	});

	it("shows a streaming indicator while the assistant message is still empty", () => {
		render(
			<IngestChatView
				selectedStageId={null}
				stages={stages}
				agents={[
					buildAgentRun({
						state: "running",
						messages: [
							buildTextMessage("user-1", "user", "Parse this exam PDF."),
							buildAssistantMessage([{ type: "text", text: "" }]),
						],
					}),
				]}
			/>,
		);

		expect(
			document.querySelector('[data-slot="aui_thinking-indicator"]'),
		).toBeTruthy();
	});

	it("renders tool-call and tool-result parts from agent.messages", () => {
		render(
			<IngestChatView
				selectedStageId={null}
				stages={stages}
				agents={[
					buildAgentRun({
						state: "running",
						messages: [
							buildAssistantMessage([
								{ type: "text", text: "Reviewing q1." },
								buildDynamicToolPart({
									toolCallId: "tc-1",
									toolName: "update_extracted_question",
									state: "output-available",
									input: {
										questionId: "q1",
										answer: "2x",
										topic: "Derivatives",
									},
									output: { ok: true, questionId: "q1" },
								}),
							]),
						],
					}),
				]}
			/>,
		);

		expect(document.body.textContent).toContain("tool call");
		expect(document.body.textContent).not.toContain("Agent Work");
	});

	it("auto-scrolls when text is appended to the same assistant message", async () => {
		const scrollToSpy = vi.fn();
		HTMLElement.prototype.scrollTo = scrollToSpy;

		const { rerender } = render(
			<IngestChatView
				selectedStageId={null}
				stages={stages}
				agents={[
					buildAgentRun({
						state: "running",
						messages: [
							buildAssistantMessage([
								{ type: "text", text: "Streaming partial" },
							]),
						],
					}),
				]}
			/>,
		);

		scrollToSpy.mockClear();
		requestAnimationFrameSpy.mockClear();

		rerender(
			<IngestChatView
				selectedStageId={null}
				stages={stages}
				agents={[
					buildAgentRun({
						state: "running",
						messages: [
							buildAssistantMessage([
								{ type: "text", text: "Streaming partial response" },
							]),
						],
					}),
				]}
			/>,
		);

		await waitFor(() => {
			expect(requestAnimationFrameSpy).toHaveBeenCalled();
			expect(scrollToSpy).toHaveBeenCalledWith({
				top: expect.any(Number),
				behavior: "smooth",
			});
		});
	});

	it("auto-scrolls when a tool-call is appended to the same assistant message", async () => {
		const scrollToSpy = vi.fn();
		HTMLElement.prototype.scrollTo = scrollToSpy;

		const baseMessage = buildAssistantMessage([
			{ type: "text", text: "Reviewing q1." },
		]);

		const { rerender } = render(
			<IngestChatView
				selectedStageId={null}
				stages={stages}
				agents={[
					buildAgentRun({
						state: "running",
						messages: [baseMessage],
					}),
				]}
			/>,
		);

		scrollToSpy.mockClear();
		requestAnimationFrameSpy.mockClear();

		rerender(
			<IngestChatView
				selectedStageId={null}
				stages={stages}
				agents={[
					buildAgentRun({
						state: "running",
						messages: [
							buildAssistantMessage([
								...baseMessage.parts,
								buildDynamicToolPart({
									toolCallId: "tc-1",
									toolName: "list_extracted_questions",
									state: "input-available",
									input: {},
								}),
							]),
						],
					}),
				]}
			/>,
		);

		await waitFor(() => {
			expect(requestAnimationFrameSpy).toHaveBeenCalled();
			expect(scrollToSpy).toHaveBeenCalledWith({
				top: expect.any(Number),
				behavior: "smooth",
			});
		});
		expect(document.body.textContent).toContain("tool call");
		expect(document.body.textContent).not.toContain("Agent Work");
	});

	it("auto-scrolls when a tool-result is appended to the same assistant message", async () => {
		const scrollToSpy = vi.fn();
		HTMLElement.prototype.scrollTo = scrollToSpy;

		const baseMessage = buildAssistantMessage([
			{ type: "text", text: "Reviewing q1." },
			buildDynamicToolPart({
				toolCallId: "tc-1",
				toolName: "update_extracted_question",
				state: "input-available",
				input: { questionId: "q1" },
			}),
		]);

		const { rerender } = render(
			<IngestChatView
				selectedStageId={null}
				stages={stages}
				agents={[
					buildAgentRun({
						state: "running",
						messages: [baseMessage],
					}),
				]}
			/>,
		);

		scrollToSpy.mockClear();
		requestAnimationFrameSpy.mockClear();

		rerender(
			<IngestChatView
				selectedStageId={null}
				stages={stages}
				agents={[
					buildAgentRun({
						state: "running",
						messages: [
							buildAssistantMessage([
								{ type: "text", text: "Reviewing q1." },
								buildDynamicToolPart({
									toolCallId: "tc-1",
									toolName: "update_extracted_question",
									state: "output-available",
									input: { questionId: "q1" },
									output: { ok: true, questionId: "q1" },
								}),
							]),
						],
					}),
				]}
			/>,
		);

		await waitFor(() => {
			expect(requestAnimationFrameSpy).toHaveBeenCalled();
			expect(scrollToSpy).toHaveBeenCalledWith({
				top: expect.any(Number),
				behavior: "smooth",
			});
		});
	});
});
