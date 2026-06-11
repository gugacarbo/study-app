import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	applyTokenEvent,
	applyWarningEvent,
	syncJobTokenTotals,
	upsertAgentRun,
} from "@/features/background-processes/kinds/ingest/job-utils";
import {
	clearCompletedIngestProcessesFromState,
	hydrateBackgroundProcessStateFromStorage,
	serializeBackgroundProcessStateForStorage,
} from "@/features/background-processes/store/persistence";
import { canStart, runNextQueued } from "@/features/background-processes/store/scheduler";
import { backgroundProcessStore } from "@/features/background-processes/store/store";
import type {
	BackgroundProcessStoreState,
	ExplanationGenerationBackgroundProcess,
	ImproveQuestionsBackgroundProcess,
	IngestBackgroundProcess,
} from "@/features/background-processes/store/types";
import {
	BACKGROUND_PROCESS_STORAGE_KEY,
	explanationGenerationProcessId,
	getActiveProcesses,
	improveQuestionsProcessId,
	ingestJobToProcess,
	ingestProcessId,
	isActiveProcess,
	isIngestProcess,
} from "@/features/background-processes/store/types";
import type { IngestAgentRun, IngestJob } from "@/features/ingest/store/types";
import type { IngestAgentEvent, IngestTokenEvent } from "@/lib/sse-stream";

const { startQueuedIngest, startQueuedImproveQuestions, startQueuedExplanationGeneration } =
	vi.hoisted(() => ({
		startQueuedIngest: vi.fn(),
		startQueuedImproveQuestions: vi.fn(),
		startQueuedExplanationGeneration: vi.fn(),
	}));

vi.mock("@/features/background-processes/kinds/ingest/actions", () => ({
	startQueuedIngest,
}));

vi.mock("@/features/background-processes/kinds/improve-questions/actions", () => ({
	startQueuedImproveQuestions,
}));

vi.mock("@/features/background-processes/kinds/explanation-generation/actions", () => ({
	startQueuedExplanationGeneration,
}));

function createJob(overrides?: Partial<IngestJob>): IngestJob {
	return {
		id: "job-1",
		fileName: "exam.txt",
		status: "running",
		createdAt: 1,
		startedAt: 2,
		finishedAt: null,
		stepText: "Running review",
		logs: [],
		outputEntries: [],
		agentRuns: [],
		tokenTotals: { prompt: 0, completion: 0, total: 0 },
		nonAgentTokenTotals: { prompt: 0, completion: 0, total: 0 },
		warnings: [],
		result: null,
		error: null,
		flowStages: [],
		buffer: [],
		enableReview: true,
		enableExplanations: false,
		agentConcurrency: 10,
		rawStreamText: "",
		...overrides,
	};
}

function createIngestProcess(
	overrides?: Partial<IngestBackgroundProcess>,
): IngestBackgroundProcess {
	const rawId = overrides?.id?.replace(/^ingest:/, "") ?? "job-1";
	const { id: _id, kind: _kind, ...jobOverrides } = overrides ?? {};
	return {
		...ingestJobToProcess(createJob({ id: rawId, ...jobOverrides })),
		...overrides,
		kind: "ingest",
	};
}

function createState(
	overrides?: Partial<BackgroundProcessStoreState>,
): BackgroundProcessStoreState {
	return {
		processes: [],
		focusedProcessId: null,
		improveQuestionsBatchByExam: {},
		...overrides,
	};
}

function agentEvent(
	overrides?: Partial<IngestAgentEvent>,
): IngestAgentEvent {
	return {
		agentRunId: "agent-1",
		stageId: "review",
		label: "Reviewer Q1",
		status: "running",
		timestamp: 1,
		...overrides,
	};
}

function tokenEvent(
	overrides?: Partial<IngestTokenEvent>,
): IngestTokenEvent {
	return {
		prompt: 10,
		completion: 20,
		total: 30,
		...overrides,
	};
}

function makeAgentRun(
	overrides?: Partial<IngestAgentRun>,
): IngestAgentRun {
	return {
		id: "agent-1",
		stageId: "review",
		label: "Reviewer Q1",
		status: "running",
		timestamp: 1,
		messages: [],
		systemPrompt: "",
		userPrompt: "",
		outputText: "",
		rawOutput: null,
		error: null,
		warnings: [],
		tokenTotals: { prompt: 0, completion: 0, total: 0 },
		...overrides,
	};
}

function createImproveQuestionsProcess(
	overrides?: Partial<ImproveQuestionsBackgroundProcess>,
): ImproveQuestionsBackgroundProcess {
	return {
		kind: "improve-questions",
		id: improveQuestionsProcessId(1),
		status: "running",
		questionId: 1,
		examId: 10,
		originalSnapshot: {
			id: 1,
			exam_id: 10,
			question: "Question?",
			options: ["A", "B"],
			answers: ["A"],
			scoringMode: "exact",
			explanation: "",
			deepExplanation: "",
			topic: "General",
		},
		draftQuestion: {
			id: 1,
			exam_id: 10,
			question: "Question?",
			options: ["A", "B"],
			answers: ["A"],
			scoringMode: "exact",
			explanation: "",
			deepExplanation: "",
			topic: "General",
		},
		agentRunState: null,
		changes: [],
		isStreaming: false,
		streamError: null,
		phase: "running",
		...overrides,
	};
}

function createExplanationProcess(
	overrides?: Partial<ExplanationGenerationBackgroundProcess>,
): ExplanationGenerationBackgroundProcess {
	const examId = overrides?.examId ?? 1;
	return {
		kind: "explanation-generation",
		id: explanationGenerationProcessId(examId),
		examId,
		status: "queued",
		createdAt: 1,
		startedAt: null,
		finishedAt: null,
		progressItems: [],
		agentRuns: [],
		batchSize: 8,
		overwriteExplanations: false,
		generationMessage: null,
		questions: [
			{
				id: 1,
				question: "Question 1",
				explanation: "",
				deepExplanation: "",
			},
		],
		...overrides,
	};
}

describe("ingest job-utils (background-processes)", () => {
	it("applyWarningEvent sets agent status to warning when no existing status", () => {
		const job = createJob({
			agentRuns: [makeAgentRun({ id: "agent-1", status: "running" })],
		});

		const updated = applyWarningEvent(job, "low confidence", {
			message: "low confidence",
			agentRunId: "agent-1",
			stageId: "review",
			timestamp: 10,
		});

		expect(updated.agentRuns[0]?.status).toBe("warning");
		expect(updated.agentRuns[0]?.warnings).toContain("low confidence");
	});

	it("applyTokenEvent without agentRunId adds tokens to job and non-agent totals", () => {
		const updated = applyTokenEvent(createJob(), tokenEvent());

		expect(updated.tokenTotals).toEqual({ prompt: 10, completion: 20, total: 30 });
		expect(updated.nonAgentTokenTotals).toEqual({
			prompt: 10,
			completion: 20,
			total: 30,
		});
	});

	it("syncJobTokenTotals combines agent totals with non-agent pool", () => {
		const job = createJob({
			agentRuns: [
				makeAgentRun({
					id: "agent-1",
					tokenTotals: { prompt: 100, completion: 200, total: 300 },
				}),
			],
			nonAgentTokenTotals: { prompt: 30, completion: 40, total: 70 },
		});

		const result = syncJobTokenTotals(job);

		expect(result.tokenTotals).toEqual({
			prompt: 130,
			completion: 240,
			total: 370,
		});
	});

	it("upsertAgentRun updates agent token totals via tokens field", () => {
		const updated = upsertAgentRun(
			createJob(),
			agentEvent({
				agentRunId: "agent-1",
				tokens: { prompt: 100, completion: 200, total: 300 },
			}),
		);

		expect(updated.agentRuns).toHaveLength(1);
		expect(updated.agentRuns[0]?.tokenTotals).toEqual({
			prompt: 100,
			completion: 200,
			total: 300,
		});
	});
});

describe("background process persistence", () => {
	it("serializes ingest processes without persisting raw file buffers", () => {
		const state = createState({
			processes: [
				createIngestProcess({
					id: ingestProcessId("job-persisted"),
					buffer: [1, 2, 3],
					status: "success",
				}),
			],
			focusedProcessId: ingestProcessId("job-persisted"),
		});

		const serialized = serializeBackgroundProcessStateForStorage(state);
		const parsed = JSON.parse(serialized) as BackgroundProcessStoreState;

		expect(parsed.focusedProcessId).toBe(ingestProcessId("job-persisted"));
		expect(parsed.processes).toHaveLength(1);
		expect(parsed.processes[0]).not.toHaveProperty("buffer");
		expect(parsed.processes[0]?.kind).toBe("ingest");
	});

	it("hydrates queued and running ingest processes as canceled after reload", () => {
		const saved = JSON.stringify({
			processes: [
				{
					...createIngestProcess({
						id: ingestProcessId("job-running"),
						status: "running",
						buffer: [9, 9, 9],
						finishedAt: null,
					}),
				},
				{
					...createIngestProcess({
						id: ingestProcessId("job-done"),
						status: "success",
						finishedAt: 20,
					}),
				},
			],
			focusedProcessId: ingestProcessId("job-running"),
		});

		const hydrated = hydrateBackgroundProcessStateFromStorage(saved);

		expect(hydrated.processes).toHaveLength(2);
		expect(hydrated.processes[0]).toMatchObject({
			id: ingestProcessId("job-running"),
			kind: "ingest",
			status: "canceled",
			buffer: [],
			error: "Ingest interrupted after page reload",
			stepText: "Interrupted after reload",
		});
		const interrupted = hydrated.processes[0];
		expect(isIngestProcess(interrupted)).toBe(true);
		if (isIngestProcess(interrupted)) {
			expect(interrupted.finishedAt).toBeTypeOf("number");
		}
		expect(hydrated.processes[1]).toMatchObject({
			id: ingestProcessId("job-done"),
			kind: "ingest",
			status: "success",
			buffer: [],
		});
		expect(hydrated.focusedProcessId).toBe(ingestProcessId("job-running"));
	});

	it("hydrates legacy agent runs without messages using prompt/output fallback", () => {
		const saved = JSON.stringify({
			processes: [
				{
					...createIngestProcess({
						id: ingestProcessId("job-legacy"),
						status: "success",
						agentRuns: [
							{
								id: "agent-legacy",
								stageId: "review",
								label: "Legacy reviewer",
								status: "done",
								timestamp: 10,
								systemPrompt: "legacy system",
								userPrompt: "legacy user",
								outputText: "legacy output",
								rawOutput: null,
								error: null,
								warnings: [],
								tokenTotals: { prompt: 1, completion: 2, total: 3 },
							} as unknown as IngestAgentRun,
						],
					}),
				},
			],
			focusedProcessId: ingestProcessId("job-legacy"),
		});

		const hydrated = hydrateBackgroundProcessStateFromStorage(saved);
		const legacyProcess = hydrated.processes[0];
		const messages = isIngestProcess(legacyProcess)
			? legacyProcess.agentRuns[0]?.messages
			: undefined;

		expect(messages).toEqual([
			{
				id: "agent-legacy:system",
				role: "system",
				parts: [{ type: "text", content: "legacy system" }],
			},
			{
				id: "agent-legacy:user",
				role: "user",
				parts: [{ type: "text", content: "legacy user" }],
			},
			{
				id: "agent-legacy:assistant",
				role: "assistant",
				parts: [{ type: "text", content: "legacy output" }],
			},
		]);
	});

	it("clears only completed ingest processes from state", () => {
		const state = createState({
			processes: [
				createIngestProcess({
					id: ingestProcessId("job-running"),
					status: "running",
				}),
				createIngestProcess({
					id: ingestProcessId("job-success"),
					status: "success",
					finishedAt: 10,
				}),
				createIngestProcess({
					id: ingestProcessId("job-error"),
					status: "error",
					finishedAt: 11,
				}),
				createImproveQuestionsProcess(),
			],
			focusedProcessId: ingestProcessId("job-error"),
		});

		const nextState = clearCompletedIngestProcessesFromState(state);

		expect(nextState.processes.map((process) => process.id)).toEqual([
			improveQuestionsProcessId(1),
			ingestProcessId("job-running"),
		]);
		expect(nextState.focusedProcessId).toBeNull();
	});

	it("uses the expected localStorage key", () => {
		expect(BACKGROUND_PROCESS_STORAGE_KEY).toBe("background-processes");
	});
});

describe("background process lifecycle", () => {
	it("counts improve-questions awaiting_review as active", () => {
		const process = createImproveQuestionsProcess({
			status: "awaiting_review",
			phase: "done",
			isStreaming: false,
		});

		expect(isActiveProcess(process)).toBe(true);
		expect(getActiveProcesses([process])).toEqual([process]);
	});

	it("does not count completed ingest processes as active", () => {
		const process = createIngestProcess({ status: "success", finishedAt: 10 });

		expect(isActiveProcess(process)).toBe(false);
		expect(getActiveProcesses([process])).toEqual([]);
	});
});

describe("background process scheduler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		backgroundProcessStore.setState(() => createState());
	});

	it("blocks queued ingest while another ingest is running", () => {
		const running = createIngestProcess({ status: "running" });
		const queued = createIngestProcess({
			id: ingestProcessId("queued"),
			status: "queued",
		});

		expect(canStart(queued, [running])).toBe(false);
	});

	it("starts oldest queued ingest first when none are running", () => {
		const queuedOld = createIngestProcess({
			id: ingestProcessId("old"),
			status: "queued",
			createdAt: 100,
		});
		const queuedNew = createIngestProcess({
			id: ingestProcessId("new"),
			status: "queued",
			createdAt: 200,
		});

		backgroundProcessStore.setState(() =>
			createState({ processes: [queuedNew, queuedOld] }),
		);

		runNextQueued();

		expect(startQueuedIngest).toHaveBeenCalledTimes(1);
		expect(startQueuedIngest).toHaveBeenCalledWith(ingestProcessId("old"));
	});

	it("limits improve-questions concurrency per exam when batch config is set", () => {
		const queuedA = createImproveQuestionsProcess({
			id: improveQuestionsProcessId(1),
			questionId: 1,
			examId: 10,
			status: "queued",
		});
		const queuedB = createImproveQuestionsProcess({
			id: improveQuestionsProcessId(2),
			questionId: 2,
			examId: 10,
			status: "queued",
		});
		const queuedC = createImproveQuestionsProcess({
			id: improveQuestionsProcessId(3),
			questionId: 3,
			examId: 10,
			status: "queued",
		});

		backgroundProcessStore.setState(() =>
			createState({
				processes: [queuedA, queuedB, queuedC],
				improveQuestionsBatchByExam: { 10: { batchSize: 2 } },
			}),
		);

		runNextQueued();

		expect(startQueuedImproveQuestions).toHaveBeenCalledTimes(2);
	});

	it("starts improve-questions runs in parallel per question", () => {
		const queuedA = createImproveQuestionsProcess({
			id: improveQuestionsProcessId(1),
			questionId: 1,
			status: "queued",
		});
		const queuedB = createImproveQuestionsProcess({
			id: improveQuestionsProcessId(2),
			questionId: 2,
			status: "queued",
		});

		backgroundProcessStore.setState(() =>
			createState({ processes: [queuedA, queuedB] }),
		);

		runNextQueued();

		expect(startQueuedImproveQuestions).toHaveBeenCalledTimes(2);
		expect(startQueuedImproveQuestions).toHaveBeenCalledWith(improveQuestionsProcessId(1));
		expect(startQueuedImproveQuestions).toHaveBeenCalledWith(improveQuestionsProcessId(2));
	});

	it("blocks improve-questions for the same question while one is running", () => {
		const running = createImproveQuestionsProcess({
			id: improveQuestionsProcessId(1),
			questionId: 1,
			status: "running",
		});
		const queued = createImproveQuestionsProcess({
			id: improveQuestionsProcessId(1),
			questionId: 1,
			status: "queued",
		});

		expect(canStart(queued, [running])).toBe(false);
	});

	it("allows improve-questions awaiting_review without blocking another queued run for same question", () => {
		const awaitingReview = createImproveQuestionsProcess({
			status: "awaiting_review",
			phase: "done",
		});
		const queued = createImproveQuestionsProcess({
			status: "queued",
			phase: "idle",
		});

		expect(isActiveProcess(awaitingReview)).toBe(true);
		expect(canStart(queued, [awaitingReview])).toBe(true);
	});

	it("blocks explanation-generation for the same exam while one is running", () => {
		const running = createExplanationProcess({ examId: 1, status: "running" });
		const queued = createExplanationProcess({ examId: 1, status: "queued" });

		expect(canStart(queued, [running])).toBe(false);
	});

	it("allows explanation-generation for different exams concurrently", () => {
		const running = createExplanationProcess({ examId: 1, status: "running" });
		const queued = createExplanationProcess({ examId: 2, status: "queued" });

		expect(canStart(queued, [running])).toBe(true);
	});

	it("starts queued explanation-generation when slot is available", () => {
		const queued = createExplanationProcess({ examId: 3, status: "queued" });

		backgroundProcessStore.setState(() => createState({ processes: [queued] }));

		runNextQueued();

		expect(startQueuedExplanationGeneration).toHaveBeenCalledTimes(1);
		expect(startQueuedExplanationGeneration).toHaveBeenCalledWith(
			explanationGenerationProcessId(3),
		);
	});
});
