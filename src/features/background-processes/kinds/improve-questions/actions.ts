import type {
	ChangeDecision,
	DraftQuestion,
	ImproveQuestionsAgentEvent,
	ImproveQuestionsJobResult,
	QuestionChange,
} from "@/features/ai/agents/improve-questions/contracts";
import { consumeJobStream } from "@/features/ai/lib/read-job-ui-message-stream";
import type {
	JobResultDataPart,
	WorkspaceUpdateDataPart,
} from "@/features/ai/types/ui-message-data-parts";
import {
	agentRunDataPartToReducerEvent,
	appendFollowUpUserMessage,
	beginFollowUpAssistantTurn,
	buildTextConversationHistory,
	createAgentRunState,
	reduceAgentEvent,
	type AgentRunState,
} from "@/features/ai/utils/agent-run-messages";
import type { QuestionData } from "@/features/exams/components/detail/exam-utils";
import { getErrorMessage } from "@/features/exams/components/detail/exam-utils";
import {
	applyDecisions,
	computeQuestionChanges,
} from "@/features/exams/components/detail/improve-questions-dialog/diff-changes";
import { resolveQuestion } from "@/features/exams/components/detail/improve-questions-dialog/resolve-question";
import { queryClient } from "@/routes/__root";
import { updateQuestion } from "@/server-functions/exams";
import {
	getAbortController,
	registerAbort,
	unregisterAbort,
} from "../../store/registry";
import { runNextQueued } from "../../store/scheduler";
import {
	areImproveQuestionsExamUiEqual,
	DEFAULT_IMPROVE_QUESTIONS_EXAM_UI,
} from "../../store/improve-questions-selectors";
import { isActiveProcess } from "../../store/types";
import {
	backgroundProcessStore,
	getProcessById,
	removeProcess,
	updateProcess,
	upsertProcess,
} from "../../store/store";
import type {
	ImproveQuestionsBackgroundProcess,
	ImproveQuestionsExamUiState,
	ImproveQuestionsRunPhase,
} from "../../store/types";
import {
	improveQuestionsProcessId,
	isImproveQuestionsProcess,
} from "../../store/types";
import { cloneQuestion, draftToQuestionData, questionDataToDraft } from "./question-helpers";
import { createImproveQuestionsStoreBatcher } from "./store-sync";

export const MIN_IMPROVE_QUESTIONS_MAX_WORKERS = 1;
export const MAX_IMPROVE_QUESTIONS_MAX_WORKERS = 20;
export const DEFAULT_IMPROVE_QUESTIONS_MAX_WORKERS = 3;
export const MAX_IMPROVE_QUESTIONS_ATTEMPTS = 3;

type ImproveQuestionsProcessTimestamps = {
	createdAt: number;
	finishedAt: number | null;
};

type ImproveQuestionsProcess = ImproveQuestionsBackgroundProcess &
	ImproveQuestionsProcessTimestamps;

function syncAgentRunId(
	state: AgentRunState,
	event: ImproveQuestionsAgentEvent,
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

function phaseToStatus(
	phase: ImproveQuestionsRunPhase,
	isStreaming: boolean,
): ImproveQuestionsBackgroundProcess["status"] {
	if (isStreaming || phase === "running") return "running";
	if (phase === "done") return "awaiting_review";
	if (phase === "error") return "error";
	if (phase === "canceled") return "canceled";
	return "queued";
}

function getImproveQuestionsProcess(
	questionId: number,
): ImproveQuestionsProcess | null {
	const process = getProcessById(improveQuestionsProcessId(questionId));
	if (!process || !isImproveQuestionsProcess(process)) return null;
	return process as ImproveQuestionsProcess;
}

function updateImproveQuestionsProcess(
	questionId: number,
	updater: (process: ImproveQuestionsProcess) => ImproveQuestionsProcess,
): void {
	const processId = improveQuestionsProcessId(questionId);
	updateProcess(processId, (process) => {
		if (!isImproveQuestionsProcess(process)) return process;
		return updater(process as ImproveQuestionsProcess);
	});
}

function patchImproveQuestionsProcess(
	process: ImproveQuestionsProcess,
	patch: Partial<
		Pick<
			ImproveQuestionsProcess,
			| "originalSnapshot"
			| "draftQuestion"
			| "agentRunState"
			| "changes"
			| "isStreaming"
			| "streamError"
			| "phase"
			| "finishedAt"
		>
	>,
): ImproveQuestionsProcess {
	const nextPhase = patch.phase ?? process.phase;
	const nextStreaming = patch.isStreaming ?? process.isStreaming;
	const status = phaseToStatus(nextPhase, nextStreaming);
	const finishedAt =
		patch.finishedAt !== undefined
			? patch.finishedAt
			: status === "awaiting_review" ||
					status === "error" ||
					status === "canceled"
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
		MIN_IMPROVE_QUESTIONS_MAX_WORKERS,
		Math.min(MAX_IMPROVE_QUESTIONS_MAX_WORKERS, maxWorkers),
	);
}

function agentRunIdForAttempt(questionId: number, attempt: number): string {
	if (attempt <= 1) return `improve-questions-${questionId}`;
	return `improve-questions-${questionId}-retry-${attempt - 1}`;
}

function workspaceUpdateToDraft(
	update: WorkspaceUpdateDataPart,
): DraftQuestion {
	const question = update.question;
	return {
		id: Number(question.id),
		exam_id:
			question.exam_id != null ? Number(question.exam_id) : undefined,
		question: question.question,
		options: [...question.options],
		answers: [...question.answers],
		scoringMode: (question.scoringMode ?? "exact") as DraftQuestion["scoringMode"],
		explanation: question.explanation ?? "",
		...(question.deepExplanation !== undefined
			? { deepExplanation: question.deepExplanation }
			: {}),
		...(question.topic !== undefined ? { topic: question.topic } : {}),
	};
}

function normalizeJobResult(
	raw: JobResultDataPart,
): ImproveQuestionsJobResult | null {
	if (typeof raw !== "object" || raw == null) return null;
	const data = raw as Record<string, unknown>;

	if (data.finalQuestion && data.agentRun) {
		return {
			finalQuestion: data.finalQuestion as DraftQuestion,
			agentRun:
				data.agentRun as ImproveQuestionsJobResult["agentRun"],
		};
	}

	if (data.question && data.agentRun) {
		return {
			finalQuestion: data.question as DraftQuestion,
			agentRun:
				data.agentRun as ImproveQuestionsJobResult["agentRun"],
		};
	}

	return null;
}

function labelForAttempt(attempt: number): string {
	if (attempt <= 1) return "Improve question";
	return `Improve question (retry ${attempt - 1})`;
}

function buildUpdatePayload(
	original: QuestionData,
	resolved: QuestionData,
	changes: QuestionChange[],
): {
	question?: string;
	options?: string[];
	answers?: string[];
	explanation?: string;
} {
	const payload: {
		question?: string;
		options?: string[];
		answers?: string[];
		explanation?: string;
	} = {};

	const keepField = (field: QuestionChange["field"]) =>
		changes.some(
			(change) => change.field === field && change.decision !== "revert",
		);

	if (keepField("question")) {
		payload.question = resolved.question;
	}
	if (keepField("options")) {
		payload.options = resolved.options;
	}
	if (keepField("answer")) {
		payload.answers = resolved.answers;
	}
	if (keepField("explanation")) {
		payload.explanation = resolved.explanation;
	}

	const hasPayload =
		payload.question !== undefined ||
		payload.options !== undefined ||
		payload.answers !== undefined ||
		payload.explanation !== undefined;

	if (!hasPayload) {
		if (resolved.question !== original.question) {
			payload.question = resolved.question;
		}
		if (resolved.options.join("\0") !== original.options.join("\0")) {
			payload.options = resolved.options;
		}
		if (resolved.answers.join("\0") !== original.answers.join("\0")) {
			payload.answers = resolved.answers;
		}
		if (resolved.explanation !== original.explanation) {
			payload.explanation = resolved.explanation;
		}
	}

	return payload;
}

function createInitialProcess(
	questionId: number,
	examId: number,
	question: QuestionData,
): ImproveQuestionsProcess {
	const original = cloneQuestion(question);
	const now = Date.now();
	return {
		kind: "improve-questions",
		id: improveQuestionsProcessId(questionId),
		status: "queued",
		questionId,
		examId,
		originalSnapshot: original,
		draftQuestion: original,
		agentRunState: createAgentRunState({
			agentRunId: `improve-questions-${questionId}`,
			label: "Improve question",
		}),
		changes: [],
		isStreaming: false,
		streamError: null,
		phase: "idle",
		createdAt: now,
		finishedAt: null,
	};
}

export function getImproveQuestionsRun(
	questionId: number,
): ImproveQuestionsBackgroundProcess | null {
	return getImproveQuestionsProcess(questionId);
}

export function hasRunningImproveQuestionsRun(): boolean {
	return backgroundProcessStore.state.processes.some(
		(process) =>
			isImproveQuestionsProcess(process) &&
			(process.isStreaming ||
				process.status === "running" ||
				process.status === "queued"),
	);
}

export function setImproveQuestionsBatchConfig(
	examId: number,
	maxWorkers: number,
): void {
	backgroundProcessStore.setState((state) => ({
		...state,
		improveQuestionsBatchByExam: {
			...state.improveQuestionsBatchByExam,
			[examId]: { maxWorkers: clampMaxWorkers(maxWorkers) },
		},
	}));
}

function patchImproveQuestionsExamUi(
	examId: number,
	patch: Partial<ImproveQuestionsExamUiState>,
): void {
	backgroundProcessStore.setState((state) => {
		const current =
			state.improveQuestionsUiByExam[examId] ?? DEFAULT_IMPROVE_QUESTIONS_EXAM_UI;
		const next: ImproveQuestionsExamUiState = { ...current, ...patch };
		if (areImproveQuestionsExamUiEqual(current, next)) return state;
		return {
			...state,
			improveQuestionsUiByExam: {
				...state.improveQuestionsUiByExam,
				[examId]: next,
			},
		};
	});
}

export function setImproveQuestionsBatchDialogOpen(
	examId: number,
	open: boolean,
): void {
	patchImproveQuestionsExamUi(examId, { batchDialogOpen: open });
}

export function setImproveQuestionsQuestionDialogOpen(
	examId: number,
	questionId: number | null,
): void {
	patchImproveQuestionsExamUi(examId, { questionDialogQuestionId: questionId });
}

export function maybeClearImproveQuestionsBatchConfig(examId: number): void {
	const hasActive = backgroundProcessStore.state.processes.some(
		(process) =>
			isImproveQuestionsProcess(process) &&
			process.examId === examId &&
			isActiveProcess(process),
	);
	if (hasActive) return;

	backgroundProcessStore.setState((state) => {
		if (!(examId in state.improveQuestionsBatchByExam)) return state;
		const { [examId]: _removed, ...rest } = state.improveQuestionsBatchByExam;
		return { ...state, improveQuestionsBatchByExam: rest };
	});
}

export function startImproveQuestionsBatch(
	examId: number,
	questions: QuestionData[],
	maxWorkers: number,
): void {
	setImproveQuestionsBatchConfig(examId, maxWorkers);
	setImproveQuestionsBatchDialogOpen(examId, true);

	for (const question of questions) {
		startImproveQuestionsRun(question.id, examId, question);
	}

	runNextQueued();
}

export function canContinueImproveQuestionsRun(
	questionId: number,
): boolean {
	const process = getImproveQuestionsProcess(questionId);
	if (!process) return false;
	if (
		process.isStreaming ||
		process.status === "running" ||
		process.status === "queued"
	) {
		return false;
	}
	if (process.status === "awaiting_review" || process.phase === "done") {
		return false;
	}
	return (
		process.status === "error" ||
		process.phase === "error" ||
		process.status === "canceled" ||
		process.phase === "canceled"
	);
}

export function canSendImproveQuestionsFollowUp(questionId: number): boolean {
	const process = getImproveQuestionsProcess(questionId);
	if (!process) return false;
	if (
		process.isStreaming ||
		process.status === "running" ||
		process.status === "queued"
	) {
		return false;
	}
	return process.status === "awaiting_review" || process.phase === "done";
}

export function sendImproveQuestionsFollowUp(
	questionId: number,
	message: string,
): boolean {
	const trimmed = message.trim();
	if (!trimmed) return false;

	const process = getImproveQuestionsProcess(questionId);
	if (!process || !canSendImproveQuestionsFollowUp(questionId)) {
		return false;
	}

	const conversationHistory = buildTextConversationHistory(
		process.agentRunState?.messages ?? [],
	);
	const baseRunState =
		process.agentRunState ??
		createAgentRunState({
			agentRunId: `improve-questions-${questionId}`,
			label: "Improve question",
		});
	let runState = beginFollowUpAssistantTurn(
		appendFollowUpUserMessage(baseRunState, trimmed),
	);

	updateImproveQuestionsProcess(questionId, (run) =>
		patchImproveQuestionsProcess(run, {
			agentRunState: runState,
			isStreaming: true,
			phase: "running",
			streamError: null,
			finishedAt: null,
		}),
	);

	runImproveQuestionsFollowUpStream(questionId, trimmed, conversationHistory, runState);
	return true;
}

function runImproveQuestionsFollowUpStream(
	questionId: number,
	followUpMessage: string,
	conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
	initialRunState: AgentRunState,
): void {
	const processId = improveQuestionsProcessId(questionId);
	const controller = new AbortController();
	registerAbort(processId, controller);

	void (async () => {
		const batcher = createImproveQuestionsStoreBatcher(questionId);
		let runState = initialRunState;

		try {
			let jobCompleted = false;

			const finishJob = (finalQuestion: DraftQuestion) => {
				jobCompleted = true;
				batcher.dispose();
				updateImproveQuestionsProcess(questionId, (run) => {
					const finalDraft = draftToQuestionData(
						finalQuestion,
						run.originalSnapshot,
					);
					return patchImproveQuestionsProcess(run, {
						draftQuestion: finalDraft,
						changes: computeQuestionChanges(
							run.originalSnapshot,
							finalDraft,
						),
						agentRunState: { ...runState, status: "done" },
						isStreaming: false,
						phase: "done",
					});
				});
				runNextQueued();
			};

			const current = getImproveQuestionsProcess(questionId);
			if (!current) {
				throw new Error("Improve question run disappeared before follow-up");
			}

			await consumeJobStream(
				{
					url: "/api/improve-questions",
					init: {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							questionId,
							followUpMessage,
							draftQuestion: questionDataToDraft(current.draftQuestion),
							conversationHistory,
						}),
					},
					signal: controller.signal,
				},
				{
					onData: (part) => {
						if (part.type === "data-agent-run") {
							const event = part.data as ImproveQuestionsAgentEvent;
							runState = syncAgentRunId(runState, event);
							const reducerEvent =
								agentRunDataPartToReducerEvent(event) ?? event;
							runState = reduceAgentEvent(runState, reducerEvent);
							batcher.queue({ agentRunState: { ...runState } });
							return;
						}

						if (part.type === "data-workspace-update") {
							const active = getImproveQuestionsProcess(questionId);
							if (!active) return;
							batcher.queue({
								draftQuestion: draftToQuestionData(
									workspaceUpdateToDraft(part.data),
									active.originalSnapshot,
								),
							});
							return;
						}

						if (part.type === "data-job-result") {
							const jobResult = normalizeJobResult(part.data);
							if (!jobResult) return;
							finishJob(jobResult.finalQuestion);
						}
					},
				},
			);

			if (!jobCompleted) {
				throw new Error(
					"Improve question follow-up stream finished without a job result",
				);
			}
		} catch (error) {
			if (controller.signal.aborted || isAbortError(error)) {
				return;
			}

			const message = getErrorMessage(error);
			updateImproveQuestionsProcess(questionId, (run) =>
				patchImproveQuestionsProcess(run, {
					streamError: message,
					isStreaming: false,
					phase: "done",
					agentRunState: {
						...runState,
						status: "error",
						error: message,
					},
				}),
			);
			runNextQueued();
		} finally {
			batcher.dispose();
			unregisterAbort(processId);
		}
	})();
}

export function continueImproveQuestionsRun(questionId: number): boolean {
	if (!canContinueImproveQuestionsRun(questionId)) return false;

	updateImproveQuestionsProcess(questionId, (run) =>
		patchImproveQuestionsProcess(run, {
			draftQuestion: cloneQuestion(run.originalSnapshot),
			changes: [],
			isStreaming: false,
			streamError: null,
			phase: "idle",
			finishedAt: null,
			agentRunState: createAgentRunState({
				agentRunId: `improve-questions-${questionId}`,
				label: "Improve question",
			}),
		}),
	);
	runNextQueued();
	return true;
}

export function startImproveQuestionsRun(
	questionId: number,
	examId: number,
	question: QuestionData,
): void {
	const existing = getImproveQuestionsProcess(questionId);
	if (
		existing?.isStreaming ||
		existing?.status === "running" ||
		existing?.status === "queued"
	) {
		return;
	}
	if (existing) {
		if (canContinueImproveQuestionsRun(questionId)) {
			continueImproveQuestionsRun(questionId);
		}
		return;
	}

	upsertProcess(createInitialProcess(questionId, examId, question));
	runNextQueued();
}

export function startQueuedImproveQuestions(processId: string): void {
	const process = getProcessById(processId);
	if (!process || !isImproveQuestionsProcess(process)) return;
	if (process.status !== "queued") return;

	const improveProcess = process as ImproveQuestionsProcess;
	const { questionId } = improveProcess;

	const controller = new AbortController();
	registerAbort(processId, controller);

	updateImproveQuestionsProcess(questionId, (current) =>
		patchImproveQuestionsProcess(current, {
			isStreaming: true,
			phase: "running",
			streamError: null,
		}),
	);

	void (async () => {
		const batcher = createImproveQuestionsStoreBatcher(questionId);

		try {
			for (let attempt = 1; attempt <= MAX_IMPROVE_QUESTIONS_ATTEMPTS; attempt++) {
				let runState = createAgentRunState({
					agentRunId: agentRunIdForAttempt(questionId, attempt),
					label: labelForAttempt(attempt),
				});

				if (attempt > 1) {
					batcher.flush({
						draftQuestion: cloneQuestion(
							getImproveQuestionsProcess(questionId)?.originalSnapshot ??
								improveProcess.originalSnapshot,
						),
						changes: [],
						isStreaming: true,
						phase: "running",
						streamError: null,
						agentRunState: runState,
					});
				}

				try {
					let jobCompleted = false;

					const finishJob = (finalQuestion: DraftQuestion) => {
						jobCompleted = true;
						batcher.dispose();
						updateImproveQuestionsProcess(questionId, (run) => {
							const finalDraft = draftToQuestionData(
								finalQuestion,
								run.originalSnapshot,
							);
							return patchImproveQuestionsProcess(run, {
								draftQuestion: finalDraft,
								changes: computeQuestionChanges(
									run.originalSnapshot,
									finalDraft,
								),
								agentRunState: { ...runState, status: "done" },
								isStreaming: false,
								phase: "done",
							});
						});
						const finishedRun = getImproveQuestionsProcess(questionId);
						if (finishedRun) {
							maybeClearImproveQuestionsBatchConfig(finishedRun.examId);
						}
						runNextQueued();
					};

					await consumeJobStream(
						{
							url: "/api/improve-questions",
							init: {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ questionId }),
							},
							signal: controller.signal,
						},
						{
							onData: (part) => {
								if (part.type === "data-agent-run") {
									const event = part.data as ImproveQuestionsAgentEvent;
									runState = syncAgentRunId(runState, event);
									const reducerEvent =
										agentRunDataPartToReducerEvent(event) ?? event;
									runState = reduceAgentEvent(runState, reducerEvent);
									batcher.queue({ agentRunState: { ...runState } });
									return;
								}

								if (part.type === "data-workspace-update") {
									const current = getImproveQuestionsProcess(questionId);
									if (!current) return;
									batcher.queue({
										draftQuestion: draftToQuestionData(
											workspaceUpdateToDraft(part.data),
											current.originalSnapshot,
										),
									});
									return;
								}

								if (part.type === "data-job-result") {
									const jobResult = normalizeJobResult(part.data);
									if (!jobResult) return;
									finishJob(jobResult.finalQuestion);
								}
							},
						},
					);

					if (!jobCompleted) {
						throw new Error(
							"Improve question stream finished without a job result",
						);
					}
					return;
				} catch (error) {
					if (controller.signal.aborted || isAbortError(error)) {
						return;
					}

					const message = getErrorMessage(error);
					if (attempt < MAX_IMPROVE_QUESTIONS_ATTEMPTS) {
						batcher.flush();
						continue;
					}
					updateImproveQuestionsProcess(questionId, (run) =>
						patchImproveQuestionsProcess(run, {
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
					const erroredRun = getImproveQuestionsProcess(questionId);
					if (erroredRun) {
						maybeClearImproveQuestionsBatchConfig(erroredRun.examId);
					}
					runNextQueued();
					return;
				}
			}
		} finally {
			batcher.dispose();
		}
	})().finally(() => {
		unregisterAbort(processId);
		const current = getImproveQuestionsProcess(questionId);
		if (current?.isStreaming && !controller.signal.aborted) {
			updateImproveQuestionsProcess(questionId, (run) =>
				patchImproveQuestionsProcess(run, {
					isStreaming: false,
					phase: run.phase === "running" ? "done" : run.phase,
				}),
			);
			runNextQueued();
		}
	});
}

export function cancelImproveQuestionsRun(questionId: number): void {
	const processId = improveQuestionsProcessId(questionId);
	const abortController = getAbortController(processId);
	if (abortController) {
		abortController.abort();
		unregisterAbort(processId);
	}

	const process = getImproveQuestionsProcess(questionId);
	if (!process) {
		removeProcess(processId);
		return;
	}

	const { examId } = process;

	updateImproveQuestionsProcess(questionId, (run) =>
		patchImproveQuestionsProcess(run, {
			isStreaming: false,
			phase: "canceled",
			finishedAt: Date.now(),
		}),
	);
	removeProcess(processId);
	maybeClearImproveQuestionsBatchConfig(examId);
	runNextQueued();
}

export function dismissImproveQuestionsRun(questionId: number): void {
	const process = getImproveQuestionsProcess(questionId);
	if (!process) return;

	if (
		process.isStreaming ||
		process.status === "running" ||
		process.status === "queued"
	) {
		cancelImproveQuestionsRun(questionId);
		return;
	}

	const { examId } = process;
	removeProcess(improveQuestionsProcessId(questionId));
	maybeClearImproveQuestionsBatchConfig(examId);
	const ui = backgroundProcessStore.state.improveQuestionsUiByExam[examId];
	if (ui?.questionDialogQuestionId === questionId) {
		patchImproveQuestionsExamUi(examId, { questionDialogQuestionId: null });
	}
	runNextQueued();
}

export function clearImproveQuestionsBatch(examId: number): void {
	const targets = backgroundProcessStore.state.processes.filter(
		(process): process is ImproveQuestionsBackgroundProcess =>
			isImproveQuestionsProcess(process) && process.examId === examId,
	);

	for (const process of targets) {
		if (
			process.isStreaming ||
			process.status === "running" ||
			process.status === "queued"
		) {
			cancelImproveQuestionsRun(process.questionId);
			continue;
		}
		removeProcess(process.id);
	}

	maybeClearImproveQuestionsBatchConfig(examId);
	patchImproveQuestionsExamUi(examId, { questionDialogQuestionId: null });
	runNextQueued();
}

export function setImproveQuestionsDecision(
	questionId: number,
	changeId: string,
	decision: ChangeDecision,
): void {
	updateImproveQuestionsProcess(questionId, (run) =>
		patchImproveQuestionsProcess(run, {
			changes: run.changes.map((change) =>
				change.id === changeId ? { ...change, decision } : change,
			),
		}),
	);
}

export function keepAllImproveQuestionsChanges(questionId: number): void {
	updateImproveQuestionsProcess(questionId, (run) =>
		patchImproveQuestionsProcess(run, {
			changes: applyDecisions(run.changes, "keep"),
		}),
	);
}

export function revertAllImproveQuestionsChanges(questionId: number): void {
	updateImproveQuestionsProcess(questionId, (run) =>
		patchImproveQuestionsProcess(run, {
			changes: applyDecisions(run.changes, "revert"),
		}),
	);
}

function buildImproveQuestionsApplyPayload(
	run: ImproveQuestionsProcess,
	question: QuestionData,
) {
	const resolved = {
		...resolveQuestion(run.originalSnapshot, run.draftQuestion, run.changes),
		scoringMode: question.scoringMode,
		deepExplanation: question.deepExplanation,
		topic: question.topic,
		exam_id: question.exam_id,
	};
	return buildUpdatePayload(run.originalSnapshot, resolved, run.changes);
}

function hasImproveQuestionsApplyPayload(
	payload: ReturnType<typeof buildImproveQuestionsApplyPayload>,
): boolean {
	return (
		payload.question !== undefined ||
		payload.options !== undefined ||
		payload.answers !== undefined ||
		payload.explanation !== undefined
	);
}

export function canApplyImproveQuestionsRun(
	questionId: number,
	question: QuestionData,
): boolean {
	const run = getImproveQuestionsProcess(questionId);
	if (!run) return false;
	if (run.isStreaming || run.status === "running" || run.status === "queued") {
		return false;
	}
	if (run.status !== "awaiting_review" && run.phase !== "done") return false;
	return hasImproveQuestionsApplyPayload(
		buildImproveQuestionsApplyPayload(run, question),
	);
}

export async function applyImproveQuestionsRun(
	questionId: number,
	question: QuestionData,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const run = getImproveQuestionsProcess(questionId);
	if (!run) {
		return { ok: false, error: "No improve-questions run found." };
	}

	const payload = buildImproveQuestionsApplyPayload(run, question);
	if (!hasImproveQuestionsApplyPayload(payload)) {
		return { ok: false, error: "No applicable changes to save." };
	}

	try {
		await updateQuestion({
			data: {
				id: questionId,
				...payload,
			},
		});
		await queryClient.invalidateQueries({
			queryKey: ["exam-detail", run.examId],
		});
		const appliedExamId = run.examId;
		removeProcess(improveQuestionsProcessId(questionId));
		maybeClearImproveQuestionsBatchConfig(appliedExamId);
		runNextQueued();
		return { ok: true };
	} catch (error) {
		const message = getErrorMessage(error);
		console.error("Failed to apply improve questions:", error);
		updateImproveQuestionsProcess(questionId, (current) =>
			patchImproveQuestionsProcess(current, {
				streamError: message,
			}),
		);
		return { ok: false, error: message };
	}
}

export type ApplyAllReadyImproveQuestionsResult = {
	applied: number;
	failed: number;
	errors: string[];
};

export async function applyAllReadyImproveQuestionsRuns(
	questions: QuestionData[],
): Promise<ApplyAllReadyImproveQuestionsResult> {
	const readyQuestions = questions.filter((question) =>
		canApplyImproveQuestionsRun(question.id, question),
	);

	let applied = 0;
	let failed = 0;
	const errors: string[] = [];

	for (const question of readyQuestions) {
		const result = await applyImproveQuestionsRun(question.id, question);
		if (result.ok) {
			applied += 1;
			continue;
		}
		failed += 1;
		errors.push(`Q${question.id}: ${result.error}`);
	}

	return { applied, failed, errors };
}
