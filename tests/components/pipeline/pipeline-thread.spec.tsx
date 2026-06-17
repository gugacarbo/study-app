import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineThread } from "@/features/ai/pipeline/ui/pipeline-thread";
import type { UIMessage } from "ai";

vi.spyOn(window, "requestAnimationFrame").mockImplementation(
	(callback: FrameRequestCallback) => {
		setTimeout(() => callback(performance.now()), 0);
		return 1;
	},
);

function buildTextMessage(
	id: string,
	role: UIMessage["role"],
	text: string,
): UIMessage {
	return {
		id,
		role,
		parts: [{ type: "text", text }],
	};
}

describe("PipelineThread", () => {
	it("renders assistant messages in readonly mini layout with header", () => {
		render(
			<PipelineThread
				mode="readonly"
				layout="mini"
				isRunning={false}
				messages={[
					buildTextMessage("user-1", "user", "Review this question."),
					buildTextMessage(
						"assistant-1",
						"assistant",
						"Updated the wording for clarity.",
					),
				]}
				header={{
					title: "Improve Agent",
					status: {
						text: "Done",
						className: "bg-emerald-100 text-emerald-700",
					},
				}}
			/>,
		);

		expect(screen.getByText("Improve Agent")).toBeTruthy();
		expect(screen.getByText("Done")).toBeTruthy();
		expect(
			screen.getByText("Updated the wording for clarity."),
		).toBeTruthy();
	});

	it("shows panel empty state while running with no messages", () => {
		render(
			<PipelineThread
				mode="follow-up"
				layout="panel"
				isRunning
				messages={[]}
				header={{ title: "Agent Stream", isStreaming: true }}
			/>,
		);

		expect(screen.getByText("Waiting for agent output...")).toBeTruthy();
		expect(screen.getByText("Agent Stream")).toBeTruthy();
	});

	it("treats undefined messages as empty", () => {
		render(
			<PipelineThread
				mode="readonly"
				layout="panel"
				messages={undefined as unknown as UIMessage[]}
				emptyState="No messages yet."
			/>,
		);

		expect(screen.getByText("No messages yet.")).toBeTruthy();
	});
});
