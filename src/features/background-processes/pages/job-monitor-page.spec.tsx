import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JobMonitorPage } from "@/features/background-processes/pages/job-monitor-page";
import { JOB_STATUS } from "@/lib/job-kinds";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		useNavigate: () => navigate,
		Link: ({
			to,
			children,
			...props
		}: {
			to: string;
			children: React.ReactNode;
		}) => (
			<a href={to} {...props}>
				{children}
			</a>
		),
	};
});

vi.mock("@/features/background-processes/hooks/use-job-event-stream", () => ({
	useJobEventStream: vi.fn(),
}));

function renderWithQuery(ui: React.ReactNode) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>{ui}</QueryClientProvider>,
	);
}

describe("JobMonitorPage", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		navigate.mockClear();
	});

	it("renders split panels with agent and progress sections", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					status: JOB_STATUS.RUNNING,
					phase: "extracting",
					error: null,
					metadata: { examId: "exam-1", modelId: "model-1", mode: "create" },
					events: [
						{
							seq: 1,
							payload: { type: "text", text: "Extraindo questões…" },
							createdAt: null,
						},
					],
				}),
			}),
		);

		renderWithQuery(<JobMonitorPage jobId="job-1" />);

		await waitFor(() => {
			expect(
				screen.getByRole("region", { name: /chat do agente/i }),
			).toBeInTheDocument();
			expect(screen.getByText(/em andamento/i)).toBeInTheDocument();
		});
		expect(
			screen.getByRole("region", { name: /progresso da importação/i }),
		).toBeInTheDocument();
		expect(screen.getAllByText(/extraindo questões/i).length).toBeGreaterThan(
			0,
		);
		expect(
			screen.getByRole("region", { name: /eventos do job/i }),
		).toBeInTheDocument();
		expect(screen.getByText(/#1/i)).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: /eventos do job/i }),
		).toHaveTextContent(/Extraindo questões/);
	});

	it("redirects awaiting_upload jobs to /exams/new", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					status: JOB_STATUS.AWAITING_UPLOAD,
					phase: null,
					error: null,
					metadata: null,
					events: [],
				}),
			}),
		);

		renderWithQuery(<JobMonitorPage jobId="job-1" />);

		await waitFor(() => {
			expect(navigate).toHaveBeenCalledWith({ to: "/exams/new" });
		});
	});
});
