import { beforeEach, describe, expect, it, vi } from "vitest";

const { consumeJobStreamMock, runNextQueuedMock, updateQuestionMock } =
	vi.hoisted(() => ({
		consumeJobStreamMock: vi.fn(),
		runNextQueuedMock: vi.fn(),
		updateQuestionMock: vi.fn(),
	}));

vi.mock("@/features/ai/lib/read-job-ui-message-stream", () => ({
	consumeJobStream: consumeJobStreamMock,
}));

vi.mock("@/features/background-processes/store/scheduler", () => ({
	runNextQueued: runNextQueuedMock,
	canStart: vi.fn(),
}));

vi.mock("@/routes/__root", () => ({
	queryClient: { invalidateQueries: vi.fn() },
}));

vi.mock("@/server-functions/exams", () => ({
	updateQuestion: updateQuestionMock,
}));

import {
	applyAllReadyImproveQuestionsRuns,
	canApplyImproveQuestionsRun,
	canContinueImproveQuestionsRun,
	clearImproveQuestionsBatch,
	continueImproveQuestionsRun,
	dismissImproveQuestionsRun,
	MAX_IMPROVE_QUESTIONS_ATTEMPTS,
	startQueuedImproveQuestions,
	getImproveQuestionsRun,
} from "@/features/background-processes/kinds/improve-questions/actions";
import { backgroundProcessStore } from "@/features/background-processes/store/store";
import type { ImproveQuestionsBackgroundProcess } from "@/features/background-processes/store/types";
import { improveQuestionsProcessId } from "@/features/background-processes/store/types";

function createQueuedProcess(): ImproveQuestionsBackgroundProcess {
	return {
		kind: "improve-questions",
		id: improveQuestionsProcessId(1),
		status: "queued",
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
		phase: "idle",
	};
}

function emitJobResult(
	callbacks: { onData?: (part: { type: string; data: unknown }) => void },
	overrides?: {
		finalQuestion?: Record<string, unknown>;
		agentRun?: Record<string, unknown>;
	},
) {
	callbacks.onData?.({
		type: "data-job-result",
		data: {
			finalQuestion: overrides?.finalQuestion ?? {
				id: 1,
				question: "Improved?",
				options: ["A", "B"],
				answers: ["A"],
				scoringMode: "exact",
				explanation: "Because",
			},
			agentRun: overrides?.agentRun ?? {
				agentRunId: "improve-questions-1",
				label: "Improve question",
				status: "done",
				systemPrompt: "",
				userPrompt: "",
			},
		},
	});
}

function mockStreamSuccess() {
	consumeJobStreamMock.mockImplementation(
		async (_request, callbacks?: { onData?: (part: unknown) => void }) => {
			emitJobResult(callbacks ?? {});
			return { messages: [] };
		},
	);
}

async function flushAsyncWork() {
	await vi.waitFor(() => {
		expect(consumeJobStreamMock.mock.calls.length).toBeGreaterThan(0);
	});
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("startQueuedImproveQuestions retries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		backgroundProcessStore.setState(() => ({
			processes: [createQueuedProcess()],
			focusedProcessId: null,
			improveQuestionsBatchByExam: {},
			improveQuestionsUiByExam: {},
			explainQuestionsBatchByExam: {},
			explainQuestionsUiByExam: {},
		}));
	});

	it("succeeds on the first attempt without retrying", async () => {
		mockStreamSuccess();

		startQueuedImproveQuestions(improveQuestionsProcessId(1));
		await flushAsyncWork();

		expect(consumeJobStreamMock).toHaveBeenCalledTimes(1);
		const run = getImproveQuestionsRun(1);
		expect(run?.phase).toBe("done");
		expect(run?.status).toBe("awaiting_review");
	});

	it(`retries failed streams up to MAX_IMPROVE_QUESTIONS_ATTEMPTS`, async () => {
		let callCount = 0;
		consumeJobStreamMock.mockImplementation(async () => {
			callCount += 1;
			throw new Error(`attempt ${callCount} failed`);
		});

		startQueuedImproveQuestions(improveQuestionsProcessId(1));

		await vi.waitFor(() => {
			expect(consumeJobStreamMock).toHaveBeenCalledTimes(
				MAX_IMPROVE_QUESTIONS_ATTEMPTS,
			);
		});

		const run = getImproveQuestionsRun(1);
		expect(run?.phase).toBe("error");
		expect(run?.status).toBe("error");
		expect(run?.streamError).toBe(
			`attempt ${MAX_IMPROVE_QUESTIONS_ATTEMPTS} failed`,
		);
		expect(runNextQueuedMock).toHaveBeenCalled();
	});

	it("uses retry labels on subsequent attempts", async () => {
		let callCount = 0;
		consumeJobStreamMock.mockImplementation(
			async (_request, callbacks?: { onData?: (part: unknown) => void }) => {
				callCount += 1;
				if (callCount < MAX_IMPROVE_QUESTIONS_ATTEMPTS) {
					throw new Error("transient failure");
				}
				emitJobResult(callbacks ?? {}, {
					agentRun: {
						agentRunId: `improve-questions-1-retry-${MAX_IMPROVE_QUESTIONS_ATTEMPTS - 1}`,
						label: `Improve question (retry ${MAX_IMPROVE_QUESTIONS_ATTEMPTS - 1})`,
						status: "done",
						systemPrompt: "",
						userPrompt: "",
					},
				});
				return { messages: [] };
			},
		);

		startQueuedImproveQuestions(improveQuestionsProcessId(1));

		await vi.waitFor(() => {
			const run = getImproveQuestionsRun(1);
			expect(run?.phase).toBe("done");
		});

		const run = getImproveQuestionsRun(1);
		expect(consumeJobStreamMock).toHaveBeenCalledTimes(
			MAX_IMPROVE_QUESTIONS_ATTEMPTS,
		);
		expect(run?.agentRunState?.label).toBe(
			`Improve question (retry ${MAX_IMPROVE_QUESTIONS_ATTEMPTS - 1})`,
		);
	});
});

describe("continueImproveQuestionsRun", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("re-queues an errored process and triggers the scheduler", () => {
		backgroundProcessStore.setState(() => ({
			processes: [
				{
					...createQueuedProcess(),
					status: "error",
					phase: "error",
					streamError: "network failed",
					finishedAt: Date.now(),
				},
			],
			focusedProcessId: null,
			improveQuestionsBatchByExam: {},
			improveQuestionsUiByExam: {},
			explainQuestionsBatchByExam: {},
			explainQuestionsUiByExam: {},
		}));

		expect(canContinueImproveQuestionsRun(1)).toBe(true);
		expect(continueImproveQuestionsRun(1)).toBe(true);

		const run = getImproveQuestionsRun(1);
		expect(run?.status).toBe("queued");
		expect(run?.phase).toBe("idle");
		expect(run?.streamError).toBeNull();
		expect(runNextQueuedMock).toHaveBeenCalled();
	});

	it("does not continue completed or running processes", () => {
		backgroundProcessStore.setState(() => ({
			processes: [
				{
					...createQueuedProcess(),
					status: "awaiting_review",
					phase: "done",
				},
			],
			focusedProcessId: null,
			improveQuestionsBatchByExam: {},
			improveQuestionsUiByExam: {},
			explainQuestionsBatchByExam: {},
			explainQuestionsUiByExam: {},
		}));

		expect(canContinueImproveQuestionsRun(1)).toBe(false);
		expect(continueImproveQuestionsRun(1)).toBe(false);
	});
});

describe("applyAllReadyImproveQuestionsRuns", () => {
	const question = {
		id: 1,
		exam_id: 10,
		question: "Question?",
		options: ["A", "B"],
		answers: ["A"],
		scoringMode: "exact" as const,
		explanation: "",
		deepExplanation: "",
		topic: "General",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		updateQuestionMock.mockResolvedValue(undefined);
	});

	it("applies only ready runs with applicable changes", async () => {
		backgroundProcessStore.setState(() => ({
			processes: [
				{
					...createQueuedProcess(),
					status: "awaiting_review",
					phase: "done",
					draftQuestion: {
						...question,
						question: "Improved?",
					},
					changes: [
						{
							id: "question",
							field: "question",
							label: "Question stem",
							before: "Question?",
							after: "Improved?",
							decision: "pending",
						},
					],
				},
				{
					...createQueuedProcess(),
					id: improveQuestionsProcessId(2),
					questionId: 2,
					status: "error",
					phase: "error",
				},
			],
			focusedProcessId: null,
			improveQuestionsBatchByExam: {},
			improveQuestionsUiByExam: {},
			explainQuestionsBatchByExam: {},
			explainQuestionsUiByExam: {},
		}));

		expect(canApplyImproveQuestionsRun(1, question)).toBe(true);

		const result = await applyAllReadyImproveQuestionsRuns([question]);

		expect(result).toEqual({ applied: 1, failed: 0, errors: [] });
		expect(updateQuestionMock).toHaveBeenCalledTimes(1);
		expect(getImproveQuestionsRun(1)).toBeNull();
	});
});

describe("clearImproveQuestionsBatch", () => {
	it("removes completed runs for the exam and clears review UI state", () => {
		backgroundProcessStore.setState(() => ({
			processes: [
				{
					...createQueuedProcess(),
					status: "awaiting_review",
					phase: "done",
				},
				{
					...createQueuedProcess(),
					id: improveQuestionsProcessId(2),
					questionId: 2,
					status: "awaiting_review",
					phase: "done",
				},
			],
			focusedProcessId: null,
			improveQuestionsBatchByExam: { 10: { maxWorkers: 2 } },
			improveQuestionsUiByExam: {
				10: { batchDialogOpen: true, questionDialogQuestionId: 1 },
			},
			explainQuestionsBatchByExam: {},
			explainQuestionsUiByExam: {},
		}));

		clearImproveQuestionsBatch(10);

		expect(backgroundProcessStore.state.processes).toHaveLength(0);
		expect(backgroundProcessStore.state.improveQuestionsBatchByExam[10]).toBeUndefined();
		expect(backgroundProcessStore.state.improveQuestionsUiByExam[10]).toEqual({
			batchDialogOpen: true,
			questionDialogQuestionId: null,
		});
		expect(runNextQueuedMock).toHaveBeenCalled();
	});
});

describe("dismissImproveQuestionsRun", () => {
	it("removes a completed run without aborting", () => {
		backgroundProcessStore.setState(() => ({
			processes: [
				{
					...createQueuedProcess(),
					status: "awaiting_review",
					phase: "done",
				},
			],
			focusedProcessId: null,
			improveQuestionsBatchByExam: {},
			improveQuestionsUiByExam: {
				10: { batchDialogOpen: true, questionDialogQuestionId: 1 },
			},
			explainQuestionsBatchByExam: {},
			explainQuestionsUiByExam: {},
		}));

		dismissImproveQuestionsRun(1);

		expect(getImproveQuestionsRun(1)).toBeNull();
		expect(backgroundProcessStore.state.improveQuestionsUiByExam[10]).toEqual({
			batchDialogOpen: true,
			questionDialogQuestionId: null,
		});
	});
});
