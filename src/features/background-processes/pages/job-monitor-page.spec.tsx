import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
					phase: "reviewing",
					error: null,
					metadata: { examId: "exam-1", modelId: "model-1", mode: "create" },
					events: [
						{
							seq: 1,
							payload: {
								type: "text",
								text: PHASE_TEXT[INGEST_PHASE.REVIEWING],
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
		});
		expect(screen.getByRole("tab", { name: /progresso/i })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: /eventos \(1\)/i })).toBeInTheDocument();
		expect(screen.getByText(/atividade/i)).toBeInTheDocument();
	});

	it("marks the monitor as fullwidth and keeps the panels constrained to viewport height", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					status: JOB_STATUS.RUNNING,
					phase: "reviewing",
					error: null,
					metadata: { examId: "exam-1", modelId: "model-1", mode: "create" },
					events: [],
				}),
			}),
		);

		const { container } = renderWithQuery(<JobMonitorPage jobId="job-1" />);

		await waitFor(() => {
			expect(
				screen.getByRole("region", { name: /chat do agente/i }),
			).toBeInTheDocument();
		});

		const workspaceRoot = container.querySelector("[data-fullwidth]");
		expect(workspaceRoot).toHaveClass("h-full", "min-h-0", "overflow-hidden");

		const activityRegion = screen.getByRole("region", {
			name: /chat do agente/i,
		});
		const progressRegion = screen.getByRole("region", {
			name: /progresso da importação/i,
		});

		expect(activityRegion).toHaveClass("overflow-hidden", "md:min-h-0");
		expect(progressRegion).toHaveClass("overflow-hidden", "md:min-h-0");
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

	it("shows list_questions results in the activity thread", async () => {
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
								toolCallId: "submit-1",
								toolName: "submit_question",
								argsText: JSON.stringify({
									question: "Questão 1?",
									topic: "Álgebra",
									options: [{ key: "A", text: "1" }],
									answers: ["A"],
								}),
								state: "running",
							},
							createdAt: null,
						},
						{
							seq: 2,
							payload: {
								type: "tool-result",
								messageId: "ingest-step-1",
								toolCallId: "submit-1",
								result: { ok: true, index: 1 },
							},
							createdAt: null,
						},
						{
							seq: 3,
							payload: {
								type: "tool-call",
								messageId: "ingest-step-1",
								toolCallId: "submit-2",
								toolName: "submit_question",
								argsText: JSON.stringify({
									question: "Questão 2?",
									topic: "Álgebra",
									options: [{ key: "A", text: "2" }],
									answers: ["A"],
								}),
								state: "running",
							},
							createdAt: null,
						},
						{
							seq: 4,
							payload: {
								type: "tool-result",
								messageId: "ingest-step-1",
								toolCallId: "submit-2",
								result: { ok: true, index: 2 },
							},
							createdAt: null,
						},
						{
							seq: 5,
							payload: {
								type: "tool-call",
								messageId: "ingest-step-1",
								toolCallId: "list-1",
								toolName: "list_questions",
								argsText: JSON.stringify({}),
								state: "running",
							},
							createdAt: null,
						},
						{
							seq: 6,
							payload: {
								type: "tool-result",
								messageId: "ingest-step-1",
								toolCallId: "list-1",
								result: {
									ok: true,
									total: 2,
									questions: [
										{
											question: "Questão 1?",
											topic: "Álgebra",
											options: [{ key: "A", text: "1" }],
											answers: ["A"],
										},
										{
											question: "Questão 2?",
											topic: "Álgebra",
											options: [{ key: "A", text: "2" }],
											answers: ["A"],
										},
									],
								},
							},
							createdAt: null,
						},
						{
							seq: 7,
							payload: {
								type: "tool-call",
								messageId: "ingest-step-1",
								toolCallId: "finish-1",
								toolName: "finish_extraction",
								argsText: JSON.stringify({
									total: 2,
									summary: "2 questões extraídas.",
								}),
								state: "running",
							},
							createdAt: null,
						},
						{
							seq: 8,
							payload: {
								type: "tool-result",
								messageId: "ingest-step-1",
								toolCallId: "finish-1",
								result: {
									ok: true,
									total: 2,
									summary: "2 questões extraídas.",
									verified: true,
								},
							},
							createdAt: null,
						},
					],
				}),
			}),
		);

		renderWithQuery(<JobMonitorPage jobId="job-1" />);

		// Tool calls are collapsed by default; expand the list_questions call
		// to inspect its result payload.
		const listQuestionsTrigger = await waitFor(() => {
			const trigger = screen.getByRole("button", {
				name: /list_questions/i,
			});
			expect(trigger).toBeInTheDocument();
			return trigger;
		});
		fireEvent.click(listQuestionsTrigger);

		await waitFor(() => {
			expect(screen.getAllByText(/"total": 2/).length).toBeGreaterThan(0);
			expect(screen.getAllByText(/Questão 1\?/).length).toBeGreaterThan(0);
			expect(screen.getAllByText(/Questão 2\?/).length).toBeGreaterThan(0);
		});
	});

	it("renders finish_extraction alerts below the final summary", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					status: JOB_STATUS.COMPLETED,
					phase: null,
					error: null,
					metadata: { examId: "exam-1", modelId: "model-1", mode: "create" },
					events: [
						{
							seq: 1,
							payload: {
								type: "text",
								text:
									"2 questões extraídas.\n\nAlertas:\n- Questão 1 ficou com diagrama omitido.\n- Questão 2 exigiu revisão manual.",
							},
							createdAt: null,
						},
					],
				}),
			}),
		);

		renderWithQuery(<JobMonitorPage jobId="job-1" />);

		await waitFor(() => {
			expect(screen.getByText("2 questões extraídas.")).toBeInTheDocument();
			expect(screen.getByText("Alertas:")).toBeInTheDocument();
			expect(
				screen.getByText("Questão 1 ficou com diagrama omitido."),
			).toBeInTheDocument();
			expect(
				screen.getByText("Questão 2 exigiu revisão manual."),
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

	it("keeps the cancel action visible for failed jobs", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					status: JOB_STATUS.FAILED,
					phase: INGEST_PHASE.EXTRACTING,
					error: "model_timeout",
					metadata: { examId: "exam-1", modelId: "model-1", mode: "create" },
					cancelRequestedAt: null,
					events: [],
				}),
			}),
		);

		renderWithQuery(<JobMonitorPage jobId="job-1" />);

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: /^cancelar$/i }),
			).toBeInTheDocument();
		});
	});

	it("shows when cancellation was already requested for an active job", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					status: JOB_STATUS.RUNNING,
					phase: INGEST_PHASE.EXTRACTING,
					error: null,
					metadata: { examId: "exam-1", modelId: "model-1", mode: "create" },
					cancelRequestedAt: "2026-06-30T12:00:00.000Z",
					events: [],
				}),
			}),
		);

		renderWithQuery(<JobMonitorPage jobId="job-1" />);

		await waitFor(() => {
			expect(
				screen.getByText(/cancelamento solicitado/i),
			).toBeInTheDocument();
		});
		expect(
			screen.queryByRole("button", { name: /^cancelar$/i }),
		).not.toBeInTheDocument();
	});

	it("reuses activity and progress layout for improve-questions jobs", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					status: JOB_STATUS.RUNNING,
					phase: "processing_questions",
					error: null,
					metadata: {
						examId: "exam-1",
						modelId: "model-1",
						questionIds: ["q-1"],
						concurrencyLimit: 2,
						totalCount: 1,
						queuedCount: 0,
						runningCount: 1,
						completedCount: 0,
						failedCount: 0,
						cancelledCount: 0,
						pendingReviewCount: 0,
						items: [
							{
								questionId: "q-1",
								questionNumber: 1,
								status: "running",
								stage: "writing_explanations",
							},
						],
					},
					events: [
						{
							seq: 1,
							payload: {
								type: "data-improve-question-stage",
								data: { questionId: "q-1", stage: "writing_explanations" },
							},
							createdAt: null,
						},
						{
							seq: 2,
							payload: {
								type: "text",
								questionId: "q-1",
								messageId: "improve:q-1:step:1",
								text: "Refinando a questão...",
							},
							createdAt: null,
						},
						{
							seq: 3,
							payload: {
								type: "data-improve-question-warning",
								data: {
									questionId: "q-1",
									message: "A resposta marcada parece inconsistente.",
								},
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
				screen.getByRole("region", { name: /atividade do job/i }),
			).toBeInTheDocument();
			expect(
				screen.getByRole("region", { name: /progresso do job/i }),
			).toBeInTheDocument();
			expect(screen.getAllByText(/questão 1/i).length).toBeGreaterThan(0);
			expect(screen.getAllByText(/refinando a questão/i).length).toBeGreaterThan(0);
			expect(screen.getAllByText(/escrevendo explicações/i).length).toBeGreaterThan(0);
			expect(
				screen.getAllByText(/a resposta marcada parece inconsistente/i).length,
			).toBeGreaterThan(0);
			expect(screen.getAllByRole("tab", { name: /eventos \(3\)/i }).length).toBeGreaterThan(0);
		});
	});

	it("shows activity before progress in mobile tabs for improve-questions jobs", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					status: JOB_STATUS.RUNNING,
					phase: "processing_questions",
					error: null,
					metadata: {
						examId: "exam-1",
						modelId: "model-1",
						questionIds: ["q-1"],
						concurrencyLimit: 2,
						totalCount: 1,
						queuedCount: 0,
						runningCount: 1,
						completedCount: 0,
						failedCount: 0,
						cancelledCount: 0,
						pendingReviewCount: 0,
						items: [
							{
								questionId: "q-1",
								questionNumber: 1,
								status: "running",
								stage: "writing_explanations",
							},
						],
					},
					events: [
						{
							seq: 1,
							payload: {
								type: "text",
								questionId: "q-1",
								messageId: "improve:q-1:step:1",
								text: "Refinando a questão...",
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
				screen.getByRole("tablist", { name: /navegação mobile do job/i }),
			).toBeInTheDocument();
		});

		const mobileTabs = screen.getByRole("tablist", {
			name: /navegação mobile do job/i,
		});
		const tabLabels = Array.from(
			mobileTabs.querySelectorAll('[role="tab"]'),
		).map((tab) => tab.textContent?.trim());

		expect(tabLabels).toEqual(["Atividade", "Progresso", "Eventos (1)"]);
		expect(screen.getByRole("tab", { name: /atividade/i })).toHaveAttribute(
			"data-state",
			"active",
		);
	});
});
