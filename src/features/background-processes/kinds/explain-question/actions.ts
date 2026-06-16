import type { ExplainQuestionJobResult } from "@/features/ai/agents/explanations/contracts";
import type { ExplainQuestionAgentEvent } from "@/features/ai/agents/explanations/contracts";
import { consumeJobStream } from "@/features/ai/lib/read-job-ui-message-stream";
import type { JobResultDataPart } from "@/features/ai/types/ui-message-data-parts";
import {
	createAgentRunState,
	reduceAgentEvent,
	type AgentRunState,
} from "@/features/ai/utils/agent-run-messages";
import type { QuestionData } from "@/features/exams/components/detail/exam-utils";
import { getErrorMessage } from "@/features/exams/components/detail/exam-utils";
import { queryClient } from "@/routes/__root";
import {
	getAbortController,
	registerAbort,
	unregisterAbort,
} from "../../store/registry";
import { runNextQueued } from "../../store/scheduler";
import {
	areExplainQuestionsExamUiEqual,
	DEFAULT_EXPLAIN_QUESTIONS_EXAM_UI,
} from "../../store/explain-question-selectors";
import { isActiveProcess } from "../../store/types";
import {
	backgroundProcessStore,
	getProcessById,
	removeProcess,
	updateProcess,
	upsertProcess,
} from "../../store/store";
import type {
	ExplainQuestionBackgroundProcess,
	ExplainQuestionsExamUiState,
} from "../../store/types";
import {
	explainQuestionProcessId,
	isExplainQuestionProcess,
} from "../../store/types";
import { cloneQuestion, questionNeedsExplanation } from "./question-helpers";
import { createExplainQuestionStoreBatcher } from "./store-sync";

export const MIN_EXPLAIN_QUESTIONS_MAX_WORKERS = 1;
export const MAX_EXPLAIN_QUESTIONS_MAX_WORKERS = 20;
export const DEFAULT_EXPLAIN_QUESTIONS_MAX_WORKERS = 3;
export const MAX_EXPLAIN_QUESTION_ATTEMPTS = 3;

function syncAgentRunId(
	state: AgentRunState,
	event: ExplainQuestionAgentEvent,
): AgentRunState {
	if (state.agentRunId === event.agentRunId) return state;
	return {
		...state,
		agentRunId: event.agentRunId,
		label: event.label || state.label,
		systemPrompt: event.systemPrompt ?? state.systemPrompt,
		userPrompt: event.userPrompt ?? state.userPrompt,
	};
}

function getExplainQuestionProcess(
	questionId: number,
): ExplainQuestionBackgroundProcess | null {
	const process = getProcessById(explainQuestionProcessId(questionId));
	if (!process || !isExplainQuestionProcess(process)) return null;
	return process;
}

function updateExplainQuestionProcess(
	questionId: number,
	updater: (process: ExplainQuestionBackgroundProcess) => ExplainQuestionBackgroundProcess,
): void {
	const processId = explainQuestionProcessId(questionId);
	updateProcess(processId, (process) => {
		if (!isExplainQuestionProcess(process)) return process;
		return updater(process);
	});
}

function patchExplainQuestionProcess(
	process: ExplainQuestionBackgroundProcess,
	patch: Partial<
		Pick<
			ExplainQuestionBackgroundProcess,
			| "explanation"
			| "deepExplanation"
			| "agentRunState"
			| "isStreaming"
			| "streamError"
			| "phase"
			| "finishedAt"
		>
	>,
): ExplainQuestionBackgroundProcess {
	const nextPhase = patch.phase ?? process.phase;
	const nextStreaming = patch.isStreaming ?? process.isStreaming;
	const status =
		nextStreaming || nextPhase === "running"
			? "running"
			: nextPhase === "done"
				? "success"
				: nextPhase === "error"
					? "error"
					: nextPhase === "canceled"
						? "canceled"
						: "queued";
	const finishedAt =
		patch.finishedAt !== undefined
			? patch.finishedAt
			: status === "success" || status === "error" || status === "canceled"
				? (process.finishedAt ?? Date.now())
				: process.finishedAt;

	return {
		...process,
		...patch,
		status,
		finishedAt,
	};
}

function isAbortError(err: unknown): boolean {
	return err instanceof DOMException && err.name === "AbortError";
}

function clampMaxWorkers(maxWorkers: number): number {
	return Math.max(
		MIN_EXPLAIN_QUESTIONS_MAX_WORKERS,
		Math.min(MAX_EXPLAIN_QUESTIONS_MAX_WORKERS, maxWorkers),
	);
}

function agentRunIdForAttempt(questionId: number, attempt: number): string {
	if (attempt <= 1) return `explain-question-${questionId}`;
	return `explain-question-${questionId}-retry-${attempt - 1}`;
}

function labelForAttempt(attempt: number): string {
	if (attempt <= 1) return "Explain question";
	return `Explain question (retry ${attempt - 1})`;
}

function normalizeJobResult(
	raw: JobResultDataPart,
): ExplainQuestionJobResult | null {
	if (typeof raw !== "object" || raw == null) return null;
	const data = raw as Record<string, unknown>;
	if (
		typeof data.questionId !== "number" ||
		typeof data.explanation !== "string"
	) {
		return null;
	}
	return {
		questionId: data.questionId,
		explanation: data.explanation,
		deepExplanation: String(data.deepExplanation ?? ""),
		agentRun: data.agentRun as ExplainQuestionJobResult["agentRun"],
	};
}

function createInitialProcess(
	questionId: number,
	examId: number,
	question: QuestionData,
	overwrite: boolean,
): ExplainQuestionBackgroundProcess {
	const original = cloneQuestion(question);
	const now = Date.now();
	return {
		kind: "explain-question",
		id: explainQuestionProcessId(questionId),
		status: "queued",
		questionId,
		examId,
		originalSnapshot: original,
		explanation: original.explanation,
		deepExplanation: original.deepExplanation,
		overwrite,
		agentRunState: createAgentRunState({
			agentRunId: `explain-question-${questionId}`,
			label: "Explain question",
		}),
		isStreaming: false,
		streamError: null,
		phase: "idle",
		createdAt: now,
		finishedAt: null,
	};
}

export function getExplainQuestionRun(
	questionId: number,
): ExplainQuestionBackgroundProcess | null {
	return getExplainQuestionProcess(questionId);
}

export function setExplainQuestionsBatchConfig(
	examId: number,
	maxWorkers: number,
): void {
	backgroundProcessStore.setState((state) => ({
		...state,
		explainQuestionsBatchByExam: {
			...state.explainQuestionsBatchByExam,
			[examId]: { maxWorkers: clampMaxWorkers(maxWorkers) },
		},
	}));
}

function patchExplainQuestionsExamUi(
	examId: number,
	patch: Partial<ExplainQuestionsExamUiState>,
): void {
	backgroundProcessStore.setState((state) => {
		const current =
			state.explainQuestionsUiByExam[examId] ?? DEFAULT_EXPLAIN_QUESTIONS_EXAM_UI;
		const next: ExplainQuestionsExamUiState = { ...current, ...patch };
		if (areExplainQuestionsExamUiEqual(current, next)) return state;
		return {
			...state,
			explainQuestionsUiByExam: {
				...state.explainQuestionsUiByExam,
				[examId]: next,
			},
		};
	});
}

export function setExplainQuestionsBatchDialogOpen(
	examId: number,
	open: boolean,
): void {
	patchExplainQuestionsExamUi(examId, { batchDialogOpen: open });
}

export function maybeClearExplainQuestionsBatchConfig(examId: number): void {
	const hasActive = backgroundProcessStore.state.processes.some(
		(process) =>
			isExplainQuestionProcess(process) &&
			process.examId === examId &&
			isActiveProcess(process),
	);
	if (hasActive) return;

	backgroundProcessStore.setState((state) => {
		if (!(examId in state.explainQuestionsBatchByExam)) return state;
		const { [examId]: _removed, ...rest } = state.explainQuestionsBatchByExam;
		return { ...state, explainQuestionsBatchByExam: rest };
	});
}

export function startExplainQuestionsBatch(
	examId: number,
	questions: QuestionData[],
	maxWorkers: number,
	overwrite: boolean,
): void {
	setExplainQuestionsBatchConfig(examId, maxWorkers);
	setExplainQuestionsBatchDialogOpen(examId, true);

	for (const question of questions) {
		startExplainQuestionRun(question.id, examId, question, { overwrite });
	}

	runNextQueued();
}

export function startExplainQuestionRun(
	questionId: number,
	examId: number,
	question: QuestionData,
	options?: { overwrite?: boolean },
): void {
	const overwrite = options?.overwrite ?? false;
	if (!questionNeedsExplanation(question, overwrite)) {
		return;
	}

	const existing = getExplainQuestionProcess(questionId);
	if (
		existing?.isStreaming ||
		existing?.status === "running" ||
		existing?.status === "queued"
	) {
		return;
	}
	if (existing) {
		if (canContinueExplainQuestionRun(questionId)) {
			continueExplainQuestionRun(questionId);
		}
		return;
	}

	upsertProcess(createInitialProcess(questionId, examId, question, overwrite));
	runNextQueued();
}

export function canContinueExplainQuestionRun(questionId: number): boolean {
	const process = getExplainQuestionProcess(questionId);
	if (!process) return false;
	if (
		process.isStreaming ||
		process.status === "running" ||
		process.status === "queued"
	) {
		return false;
	}
	if (process.phase === "done" || process.status === "success") {
		return false;
	}
	return (
		process.status === "error" ||
		process.phase === "error" ||
		process.status === "canceled" ||
		process.phase === "canceled"
	);
}

export function continueExplainQuestionRun(questionId: number): void {
	const process = getExplainQuestionProcess(questionId);
	if (!process || !canContinueExplainQuestionRun(questionId)) return;

	updateExplainQuestionProcess(questionId, (current) =>
		patchExplainQuestionProcess(current, {
			isStreaming: false,
			phase: "idle",
			streamError: null,
			finishedAt: null,
		}),
	);
	runNextQueued();
}

export function startQueuedExplainQuestion(processId: string): void {
	const process = getProcessById(processId);
	if (!process || !isExplainQuestionProcess(process)) return;
	if (process.status !== "queued") return;

	const explainProcess = process;
	const { questionId, examId, overwrite } = explainProcess;

	const controller = new AbortController();
	registerAbort(processId, controller);

	updateExplainQuestionProcess(questionId, (current) =>
		patchExplainQuestionProcess(current, {
			isStreaming: true,
			phase: "running",
			streamError: null,
		}),
	);

	void (async () => {
		const batcher = createExplainQuestionStoreBatcher(questionId);

		try {
			for (let attempt = 1; attempt <= MAX_EXPLAIN_QUESTION_ATTEMPTS; attempt++) {
				let runState = createAgentRunState({
					agentRunId: agentRunIdForAttempt(questionId, attempt),
					label: labelForAttempt(attempt),
				});

				if (attempt > 1) {
					batcher.flush({
						explanation: explainProcess.originalSnapshot.explanation,
						deepExplanation: explainProcess.originalSnapshot.deepExplanation,
						isStreaming: true,
						phase: "running",
						streamError: null,
						agentRunState: runState,
					});
				}

				try {
					let jobCompleted = false;

					const finishJob = (result: ExplainQuestionJobResult) => {
						jobCompleted = true;
						batcher.dispose();
						updateExplainQuestionProcess(questionId, (run) =>
							patchExplainQuestionProcess(run, {
								explanation: result.explanation,
								deepExplanation: result.deepExplanation,
								agentRunState: { ...runState, status: "done" },
								isStreaming: false,
								phase: "done",
							}),
						);
						void queryClient.invalidateQueries({
							queryKey: ["exam-detail", examId],
						});
						maybeClearExplainQuestionsBatchConfig(examId);
						runNextQueued();
					};

					await consumeJobStream(
						{
							url: "/api/explain-question",
							init: {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ questionId, overwrite }),
							},
							signal: controller.signal,
						},
						{
							onData: (part) => {
								if (part.type === "data-agent-run") {
									const event = part.data as ExplainQuestionAgentEvent;
									runState = syncAgentRunId(runState, event);
									runState = reduceAgentEvent(runState, event);
									batcher.queue({ agentRunState: { ...runState } });
								}

								if (part.type === "data-job-result") {
									const jobResult = normalizeJobResult(part.data);
									if (!jobResult) return;
									finishJob(jobResult);
								}
							},
						},
					);

					if (!jobCompleted) {
						throw new Error(
							"Explain question stream finished without a job result",
						);
					}
					return;
				} catch (error) {
					if (controller.signal.aborted || isAbortError(error)) {
						return;
					}

					const message = getErrorMessage(error);
					if (attempt < MAX_EXPLAIN_QUESTION_ATTEMPTS) {
						batcher.flush();
						continue;
					}
					updateExplainQuestionProcess(questionId, (run) =>
						patchExplainQuestionProcess(run, {
							streamError: message,
							isStreaming: false,
							phase: "error",
							agentRunState: {
								...runState,
								status: "error",
								error: message,
							},
						}),
					);
					maybeClearExplainQuestionsBatchConfig(examId);
					runNextQueued();
					return;
				}
			}
		} finally {
			batcher.dispose();
		}
	})().finally(() => {
		unregisterAbort(processId);
		const current = getExplainQuestionProcess(questionId);
		if (current?.isStreaming && !controller.signal.aborted) {
			updateExplainQuestionProcess(questionId, (run) =>
				patchExplainQuestionProcess(run, {
					isStreaming: false,
					phase: run.phase === "running" ? "done" : run.phase,
				}),
			);
			runNextQueued();
		}
	});
}

export function cancelExplainQuestionRun(questionId: number): void {
	const processId = explainQuestionProcessId(questionId);
	const abortController = getAbortController(processId);
	if (abortController) {
		abortController.abort();
		unregisterAbort(processId);
	}

	const process = getExplainQuestionProcess(questionId);
	if (!process) {
		removeProcess(processId);
		return;
	}

	const { examId } = process;

	updateExplainQuestionProcess(questionId, (run) =>
		patchExplainQuestionProcess(run, {
			isStreaming: false,
			phase: "canceled",
			finishedAt: Date.now(),
		}),
	);
	removeProcess(processId);
	maybeClearExplainQuestionsBatchConfig(examId);
	runNextQueued();
}

export function cancelExplainQuestionsBatch(examId: number): void {
	for (const process of backgroundProcessStore.state.processes) {
		if (!isExplainQuestionProcess(process) || process.examId !== examId) {
			continue;
		}
		if (
			process.isStreaming ||
			process.status === "running" ||
			process.status === "queued"
		) {
			cancelExplainQuestionRun(process.questionId);
		}
	}
}
