import { beforeEach, describe, expect, it, vi } from "vitest";

const { consumeJobStreamMock, runNextQueuedMock } = vi.hoisted(() => ({
	consumeJobStreamMock: vi.fn(),
	runNextQueuedMock: vi.fn(),
}));

vi.mock("@/features/ai/lib/read-job-ui-message-stream", () => ({
	consumeJobStream: consumeJobStreamMock,
}));

vi.mock("@/features/background-processes/store/scheduler", () => ({
	runNextQueued: runNextQueuedMock,
	canStart: vi.fn(),
}));

import {
	MAX_EXPLAIN_QUESTION_ATTEMPTS,
	getExplainQuestionRun,
	startQueuedExplainQuestion,
} from "@/features/background-processes/kinds/explain-question/actions";
import { backgroundProcessStore } from "@/features/background-processes/store/store";
import type { ExplainQuestionBackgroundProcess } from "@/features/background-processes/store/types";
import { explainQuestionProcessId } from "@/features/background-processes/store/types";

function createQueuedProcess(): ExplainQuestionBackgroundProcess {
	return {
		kind: "explain-question",
		id: explainQuestionProcessId(1),
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
		explanation: "",
		deepExplanation: "",
		overwrite: false,
		agentRunState: null,
		changes: [],
		isStreaming: false,
		streamError: null,
		phase: "idle",
		createdAt: Date.now(),
		finishedAt: null,
		logs: [],
		stepText: "",
	};
}

function emitExplainJobResult(
	callbacks: { onData?: (part: { type: string; data: unknown }) => void },
	overrides?: {
		explanation?: string;
		deepExplanation?: string;
	},
) {
	callbacks.onData?.({
		type: "data-job-result",
		data: {
			questionId: 1,
			explanation: overrides?.explanation ?? "Short explanation",
			deepExplanation: overrides?.deepExplanation ?? "Deep explanation",
			agentRun: {
				agentRunId: "explain-question-1",
				label: "Explain question",
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
			emitExplainJobResult(callbacks ?? {});
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

describe("startQueuedExplainQuestion", () => {
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

		startQueuedExplainQuestion(explainQuestionProcessId(1));
		await flushAsyncWork();

		expect(consumeJobStreamMock).toHaveBeenCalledTimes(1);
		const run = getExplainQuestionRun(1);
		expect(run?.phase).toBe("done");
		expect(run?.status).toBe("awaiting_review");
		expect(run?.explanation).toBe("Short explanation");
		expect(run?.deepExplanation).toBe("Deep explanation");
	});

	it(`retries failed streams up to MAX_EXPLAIN_QUESTION_ATTEMPTS`, async () => {
		let callCount = 0;
		consumeJobStreamMock.mockImplementation(async () => {
			callCount += 1;
			throw new Error(`attempt ${callCount} failed`);
		});

		startQueuedExplainQuestion(explainQuestionProcessId(1));

		await vi.waitFor(() => {
			expect(consumeJobStreamMock).toHaveBeenCalledTimes(
				MAX_EXPLAIN_QUESTION_ATTEMPTS,
			);
		});

		const run = getExplainQuestionRun(1);
		expect(run?.phase).toBe("error");
		expect(run?.status).toBe("error");
		expect(run?.streamError).toBe(
			`attempt ${MAX_EXPLAIN_QUESTION_ATTEMPTS} failed`,
		);
		expect(runNextQueuedMock).toHaveBeenCalled();
	});

	it("uses retry labels on subsequent attempts", async () => {
		let callCount = 0;
		consumeJobStreamMock.mockImplementation(
			async (_request, callbacks?: { onData?: (part: unknown) => void }) => {
				callCount += 1;
				if (callCount < MAX_EXPLAIN_QUESTION_ATTEMPTS) {
					throw new Error("transient failure");
				}
				emitExplainJobResult(callbacks ?? {}, {
					explanation: "Recovered",
					deepExplanation: "Recovered deep",
				});
				return { messages: [] };
			},
		);

		startQueuedExplainQuestion(explainQuestionProcessId(1));

		await vi.waitFor(() => {
			const run = getExplainQuestionRun(1);
			expect(run?.phase).toBe("done");
		});

		const run = getExplainQuestionRun(1);
		expect(consumeJobStreamMock).toHaveBeenCalledTimes(
			MAX_EXPLAIN_QUESTION_ATTEMPTS,
		);
		expect(run?.agentRunState?.label).toBe(
			`Explain question (retry ${MAX_EXPLAIN_QUESTION_ATTEMPTS - 1})`,
		);
	});
});
