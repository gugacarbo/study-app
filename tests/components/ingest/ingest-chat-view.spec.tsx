import { render, screen } from "@testing-library/react";
import type { UIMessage } from "@tanstack/ai-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IngestChatView } from "@/features/ingest/components/ingest-chat-view";
import type {
	IngestAgentRunViewModel,
	IngestPipelineStageViewModel,
} from "@/features/ingest/components/types";

const requestAnimationFrameSpy = vi
	.spyOn(window, "requestAnimationFrame")
	.mockImplementation((callback: FrameRequestCallback) => {
		callback(0);
		return 1;
	});

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

function buildStreamingMessage(
	parts: UIMessage["parts"],
	messageId = "assistant-1",
): UIMessage {
	return {
		id: messageId,
		role: "assistant",
		parts,
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
		expect(screen.getByText("System Prompt")).toBeTruthy();
		expect(screen.getByText("User Prompt")).toBeTruthy();
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

	it("shows a thinking placeholder while the assistant message is still empty", () => {
		render(
			<IngestChatView
				selectedStageId={null}
				stages={stages}
				agents={[
					buildAgentRun({
						state: "running",
						messages: [
							buildTextMessage("user-1", "user", "Parse this exam PDF."),
							buildStreamingMessage([{ type: "text", content: "" }]),
						],
					}),
				]}
			/>,
		);

		expect(screen.getByText("Thinking...")).toBeTruthy();
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
							buildStreamingMessage([
								{ type: "text", content: "Reviewing q1." },
								{
									type: "tool-call",
									id: "tc-1",
									name: "update_extracted_question",
									arguments:
										'{"questionId":"q1","answer":"2x","topic":"Derivatives"}',
									input: {
										questionId: "q1",
										answer: "2x",
										topic: "Derivatives",
									},
									state: "input-complete",
								},
								{
									type: "tool-result",
									toolCallId: "tc-1",
									content: '{"ok":true,"questionId":"q1"}',
									state: "complete",
								},
							]),
						],
					}),
				]}
			/>,
		);

		expect(document.body.textContent).toContain("Tool call: update_extracted_question");
		expect(document.body.textContent).not.toContain("Agent Work");
		expect(document.body.textContent).not.toContain("(input complete)");
		expect(document.body.textContent).not.toContain("Tool result");
	});

	it("auto-scrolls when text is appended to the same assistant message", () => {
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
							buildStreamingMessage([
								{ type: "text", content: "Streaming partial" },
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
							buildStreamingMessage([
								{ type: "text", content: "Streaming partial response" },
							]),
						],
					}),
				]}
			/>,
		);

		expect(requestAnimationFrameSpy).toHaveBeenCalled();
		expect(scrollToSpy).toHaveBeenCalledWith({
			top: expect.any(Number),
			behavior: "smooth",
		});
	});

	it("auto-scrolls when a tool-call is appended to the same assistant message", () => {
		const scrollToSpy = vi.fn();
		HTMLElement.prototype.scrollTo = scrollToSpy;

		const baseMessage = buildStreamingMessage([
			{ type: "text", content: "Reviewing q1." },
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
							buildStreamingMessage([
								...baseMessage.parts,
								{
									type: "tool-call",
									id: "tc-1",
									name: "list_extracted_questions",
									arguments: "{}",
									input: {},
									state: "input-complete",
								},
							]),
						],
					}),
				]}
			/>,
		);

		expect(requestAnimationFrameSpy).toHaveBeenCalled();
		expect(scrollToSpy).toHaveBeenCalledWith({
			top: expect.any(Number),
			behavior: "smooth",
		});
		expect(document.body.textContent).toContain("Tool call: list_extracted_questions");
		expect(document.body.textContent).not.toContain("Agent Work");
	});

	it("auto-scrolls when a tool-result is appended to the same assistant message", () => {
		const scrollToSpy = vi.fn();
		HTMLElement.prototype.scrollTo = scrollToSpy;

		const baseMessage = buildStreamingMessage([
			{ type: "text", content: "Reviewing q1." },
			{
				type: "tool-call",
				id: "tc-1",
				name: "update_extracted_question",
				arguments: '{"questionId":"q1"}',
				input: { questionId: "q1" },
				state: "input-complete",
			},
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
							buildStreamingMessage([
								...baseMessage.parts,
								{
									type: "tool-result",
									toolCallId: "tc-1",
									content: '{"ok":true,"questionId":"q1"}',
									state: "complete",
								},
							]),
						],
					}),
				]}
			/>,
		);

		expect(requestAnimationFrameSpy).toHaveBeenCalled();
		expect(scrollToSpy).toHaveBeenCalledWith({
			top: expect.any(Number),
			behavior: "smooth",
		});
		expect(document.body.textContent).not.toContain("Tool result");
		expect(document.body.textContent).not.toContain("(input complete)");
	});
});
