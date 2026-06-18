import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminJobsPageContent } from "@/features/admin/pages/admin-jobs-page";

const mockUseAdminJobs = vi.fn();
const mockUseAdminJobDetail = vi.fn();

vi.mock("@/features/admin/hooks/use-admin-jobs", () => ({
	useAdminJobs: () => mockUseAdminJobs(),
	useAdminJobDetail: (...args: unknown[]) => mockUseAdminJobDetail(...args),
	ADMIN_JOBS_KEY: ["admin", "jobs"],
}));

function renderWithQuery(ui: React.ReactNode) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>{ui}</QueryClientProvider>,
	);
}

describe("admin jobs page", () => {
	afterEach(() => cleanup());

	it("renders jobs table and opens detail sheet on row click", async () => {
		const jobId = "11111111-1111-4111-8111-111111111111";

		mockUseAdminJobs.mockReturnValue({
			data: [
				{
					id: jobId,
					userId: "22222222-2222-4222-8222-222222222222",
					userEmail: "aluno@aluno.ifsc.edu.br",
					kind: "ingest",
					status: "running",
					phase: "extracting",
					error: null,
					metadata: null,
					cancelRequestedAt: null,
					createdAt: "2026-06-17T12:00:00.000Z",
					updatedAt: "2026-06-17T12:01:00.000Z",
				},
			],
			cancelJob: { mutateAsync: vi.fn() },
		});

		mockUseAdminJobDetail.mockReturnValue({
			data: {
				id: jobId,
				userId: "22222222-2222-4222-8222-222222222222",
				kind: "ingest",
				status: "running",
				phase: "extracting",
				error: null,
				metadata: null,
				cancelRequestedAt: null,
				createdAt: "2026-06-17T12:00:00.000Z",
				updatedAt: "2026-06-17T12:01:00.000Z",
				events: [],
			},
			isLoading: false,
			isError: false,
		});

		renderWithQuery(<AdminJobsPageContent />);

		expect(screen.getByText("aluno@aluno.ifsc.edu.br")).toBeInTheDocument();
		fireEvent.click(screen.getByText("aluno@aluno.ifsc.edu.br"));
		expect(screen.getByText("Detalhe do job")).toBeInTheDocument();
	});
});
