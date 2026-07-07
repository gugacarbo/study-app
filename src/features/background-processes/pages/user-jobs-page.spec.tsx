import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	UserJobsPage,
	UserJobsPageContent,
} from "@/features/background-processes/pages/user-jobs-page";
import { JOB_KIND, JOB_STATUS } from "@/lib/job-kinds";

const { listUserJobs } = vi.hoisted(() => ({
	listUserJobs: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		to,
		params,
		children,
	}: {
		to: string;
		params?: { jobId?: string };
		children: React.ReactNode;
	}) => <a href={params?.jobId ? `/jobs/${params.jobId}` : to}>{children}</a>,
}));

vi.mock("@/functions/jobs/list-user-jobs", () => ({
	listUserJobs,
}));

function renderWithQuery(ui: React.ReactNode) {
	const client = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

	return render(
		<QueryClientProvider client={client}>{ui}</QueryClientProvider>,
	);
}

describe("UserJobsPage", () => {
	it("renders the user jobs list", async () => {
		listUserJobs.mockResolvedValue({
			rows: [
				{
					id: "job-1",
					kind: JOB_KIND.INGEST,
					status: JOB_STATUS.RUNNING,
					phase: "extracting",
					title: "prova-1.txt",
					error: null,
					createdAt: "2026-07-01T10:00:00.000Z",
					updatedAt: "2026-07-01T10:05:00.000Z",
				},
			],
			total: 3,
			page: 2,
			pageSize: 1,
		});

		renderWithQuery(<UserJobsPageContent page={2} onPageChange={vi.fn()} />);

		expect(
			await screen.findByRole("heading", { name: "Meus jobs" }),
		).toBeInTheDocument();
		expect(screen.getByText("prova-1.txt")).toBeInTheDocument();
		expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
	});

	it("shows the suspense fallback while loading", () => {
		listUserJobs.mockImplementation(() => new Promise(() => {}));

		renderWithQuery(<UserJobsPage page={1} onPageChange={vi.fn()} />);

		expect(screen.getByTestId("user-jobs-skeleton")).toBeInTheDocument();
	});
});
