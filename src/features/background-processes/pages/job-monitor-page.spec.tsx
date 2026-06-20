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
			params,
			children,
			...props
		}: {
			to: string;
			params?: Record<string, string>;
			children: React.ReactNode;
		}) => {
			let href = to;
			if (params) {
				for (const [key, value] of Object.entries(params)) {
					href = href.replace(`$${key}`, value);
				}
			}
			return (
				<a href={href} {...props}>
					{children}
				</a>
			);
		},
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

	it("shows Ver prova link when job completed with examId", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					status: JOB_STATUS.COMPLETED,
					phase: null,
					error: null,
					metadata: { examId: "exam-1", modelId: "model-1", mode: "create" },
					events: [],
				}),
			}),
		);

		renderWithQuery(<JobMonitorPage jobId="job-1" />);

		await waitFor(() => {
			const link = screen.getByRole("link", { name: /^ver prova$/i });
			expect(link).toHaveAttribute("href", "/exams/exam-1");
		});
	});

	it("hides Ver prova link when completed job has no examId metadata", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					status: JOB_STATUS.COMPLETED,
					phase: null,
					error: null,
					metadata: null,
					events: [],
				}),
			}),
		);

		renderWithQuery(<JobMonitorPage jobId="job-1" />);

		await waitFor(() => {
			expect(screen.getByRole("link", { name: /ver provas/i })).toBeInTheDocument();
		});
		expect(
			screen.queryByRole("link", { name: /^ver prova$/i }),
		).not.toBeInTheDocument();
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
