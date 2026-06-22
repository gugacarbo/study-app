import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ActiveJobsIndicator } from "@/features/background-processes/components/active-jobs-indicator";
import { JOB_KIND, JOB_STATUS } from "@/lib/job-kinds";

const navigateMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigateMock,
}));

const useActiveJobsMock = vi.fn();

vi.mock("@/features/background-processes/hooks/use-active-jobs", () => ({
	useActiveJobs: () => useActiveJobsMock(),
}));

beforeAll(() => {
	Object.defineProperty(Element.prototype, "hasPointerCapture", {
		value: vi.fn(),
		writable: true,
	});
	Object.defineProperty(Element.prototype, "setPointerCapture", {
		value: vi.fn(),
		writable: true,
	});
	Object.defineProperty(Element.prototype, "releasePointerCapture", {
		value: vi.fn(),
		writable: true,
	});
});

async function openIndicatorMenu() {
	const trigger = screen.getByLabelText(/job\(s\) ativo\(s\)/i);
	fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
	fireEvent.pointerUp(trigger, { button: 0, pointerType: "mouse" });
	fireEvent.click(trigger);

	await waitFor(() => {
		expect(screen.getByRole("menu")).toBeInTheDocument();
	});
}

describe("ActiveJobsIndicator", () => {
	afterEach(() => {
		cleanup();
		navigateMock.mockReset();
		useActiveJobsMock.mockReset();
	});

	it("renders nothing when there are no active jobs", () => {
		useActiveJobsMock.mockReturnValue({ data: { jobs: [] } });
		const { container } = render(<ActiveJobsIndicator />);
		expect(container).toBeEmptyDOMElement();
	});

	it("shows pulsating badge count and navigates to job on select", async () => {
		const jobId = "00000000-0000-4000-8000-000000000101";

		useActiveJobsMock.mockReturnValue({
			data: {
				jobs: [
					{
						id: jobId,
						kind: JOB_KIND.INGEST,
						status: JOB_STATUS.RUNNING,
						phase: "extracting",
						metadata: { fileName: "prova.txt" },
					},
				],
			},
		});

		render(<ActiveJobsIndicator />);

		expect(screen.getByLabelText("1 job(s) ativo(s)")).toBeInTheDocument();
		expect(screen.getByText("1")).toHaveClass("animate-pulse");

		await openIndicatorMenu();
		expect(screen.getByText("prova.txt")).toBeInTheDocument();
		expect(
			screen.getByText(/em execução · extraindo questões/i),
		).toBeInTheDocument();

		fireEvent.click(screen.getByText("prova.txt"));
		expect(navigateMock).toHaveBeenCalledWith({
			to: "/jobs/$jobId",
			params: { jobId },
		});
	});

	it("falls back to truncated job id when fileName is missing", async () => {
		const jobId = "abcdef12-3456-7890-abcd-ef1234567890";

		useActiveJobsMock.mockReturnValue({
			data: {
				jobs: [
					{
						id: jobId,
						kind: JOB_KIND.INGEST,
						status: JOB_STATUS.QUEUED,
						phase: null,
						metadata: {},
					},
				],
			},
		});

		render(<ActiveJobsIndicator />);
		await openIndicatorMenu();
		expect(screen.getByText("Job abcdef12")).toBeInTheDocument();
	});
});
