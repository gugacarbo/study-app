import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JobMonitorPage } from "@/features/background-processes/pages/job-monitor-page";
import { PHASE_TEXT } from "@/features/ai/jobs/ingest/run-ingest/constants";
import { INGEST_PHASE, JOB_STATUS } from "@/lib/job-kinds";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		useNavigate: () => navigate,
		useRouterState: (options?: {
			select?: (state: {
				location: { state?: { pendingFile?: File } };
			}) => unknown;
		}) =>
			options?.select?.({ location: { state: undefined } }) ?? undefined,
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

	it("renders split panels with activity thread and sidebar tabs", async () => {
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
							payload: {
								type: "text",
								text: PHASE_TEXT[INGEST_PHASE.EXTRACTING],
							},
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
			expect(
				screen.getByText(PHASE_TEXT[INGEST_PHASE.EXTRACTING]),
			).toBeInTheDocument();
		});
		expect(screen.getByRole("tab", { name: /progresso/i })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: /eventos \(1\)/i })).toBeInTheDocument();
		expect(screen.getByText(/atividade/i)).toBeInTheDocument();
	});

	it("shows extracted question previews in the progress panel", async () => {
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
							payload: {
								type: "tool-call",
								messageId: "ingest-step-1",
								toolCallId: "tc-1",
								toolName: "submit_question",
								argsText: JSON.stringify({
									question: "Qual e a capital de Santa Catarina?",
									topic: "Geografia",
									options: [
										{ key: "A", text: "Florianopolis" },
										{ key: "B", text: "Blumenau" },
									],
									answers: ["A"],
								}),
								state: "running",
							},
							createdAt: null,
						},
						{
							seq: 2,
							payload: {
								type: "reasoning-delta",
								messageId: "ingest-step-1",
								delta: "Analisando",
							},
							createdAt: null,
						},
					],
				}),
			}),
		);

		renderWithQuery(<JobMonitorPage jobId="job-1" />);

		await waitFor(() => {
			expect(
				screen.getByText("Qual e a capital de Santa Catarina?"),
			).toBeInTheDocument();
		});
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

	it("shows upload panel for awaiting_upload without redirecting", async () => {
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
			expect(
				screen.getByRole("region", { name: /envio de arquivo/i }),
			).toBeInTheDocument();
			expect(screen.getByLabelText(/^arquivo$/i)).toBeInTheDocument();
		});
		expect(navigate).not.toHaveBeenCalled();
	});
});
