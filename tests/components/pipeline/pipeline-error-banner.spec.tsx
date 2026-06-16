import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineErrorBanner } from "@/features/ai/pipeline/ui/pipeline-error-banner";

describe("PipelineErrorBanner", () => {
	it("renders nothing when error is empty", () => {
		const { container } = render(<PipelineErrorBanner error={null} />);
		expect(container.firstChild).toBeNull();
	});

	it("renders string errors with optional stage and actions", () => {
		const onDismiss = vi.fn();
		const onViewLogs = vi.fn();

		render(
			<PipelineErrorBanner
				error="Stream failed"
				stageId="review"
				onDismiss={onDismiss}
				onViewLogs={onViewLogs}
			/>,
		);

		expect(screen.getByRole("alert")).toBeTruthy();
		expect(screen.getByText("Stream failed")).toBeTruthy();
		expect(screen.getByText(/Stage: review/)).toBeTruthy();

		fireEvent.click(screen.getByText("View logs"));
		expect(onViewLogs).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByLabelText("Dismiss error"));
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it("renders structured PipelineErrorState messages", () => {
		render(
			<PipelineErrorBanner
				error={{
					message: "Agent run failed",
					source: "job-error",
					stageId: "extract",
					retryable: true,
				}}
			/>,
		);

		expect(screen.getByText("Agent run failed")).toBeTruthy();
		expect(screen.getByText(/Stage: extract/)).toBeTruthy();
	});
});
