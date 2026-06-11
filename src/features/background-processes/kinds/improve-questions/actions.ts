import type {
	ChangeDecision,
	ImproveQuestionsAgentEvent,
	QuestionChange,
} from "@/features/ai/agents/improve-questions/contracts";
import {
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
import { improveQuestionsStream } from "@/lib/sse-stream/improve-questions-stream";
import { queryClient } from "@/routes/__root";
import { updateQuestion } from "@/server-functions/exams";
import {
	getAbortController,
	registerAbort,
	unregisterAbort,
} from "../../store/registry";
import { runNextQueued } from "../../store/scheduler";
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
	ImproveQuestionsRunPhase,
} from "../../store/types";
import {
	improveQuestionsProcessId,
	isImproveQuestionsProcess,
} from "../../store/types";
import { cloneQuestion, draftToQuestionData } from "./question-helpers";

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
	return createAgentRunState({
		agentRunId: event.agentRunId,
		label: event.label,
		systemPrompt: event.systemPrompt,
		userPrompt: event.userPrompt,
	});
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
	batchSize: number,
): void {
	backgroundProcessStore.setState((state) => ({
		...state,
		improveQuestionsBatchByExam: {
			...state.improveQuestionsBatchByExam,
			[examId]: { batchSize },
		},
	}));
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
	batchSize: number,
): void {
	const clampedBatchSize = Math.max(1, Math.min(20, batchSize));
	setImproveQuestionsBatchConfig(examId, clampedBatchSize);

	for (const question of questions) {
		startImproveQuestionsRun(question.id, examId, question);
	}

	runNextQueued();
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
		let runState =
			getImproveQuestionsProcess(questionId)?.agentRunState ??
			createAgentRunState({
				agentRunId: `improve-questions-${questionId}`,
				label: "Improve question",
			});

		try {
			await improveQuestionsStream(
				{ questionId, signal: controller.signal },
				{
					onAgent: (event) => {
						runState = syncAgentRunId(runState, event);
						runState = reduceAgentEvent(runState, event);
						updateImproveQuestionsProcess(questionId, (run) =>
							patchImproveQuestionsProcess(run, {
								agentRunState: { ...runState },
							}),
						);
					},
					onChunk: (chunk) => {
						if (!chunk.text) return;
						runState = reduceAgentEvent(runState, {
							eventType: "text-chunk",
							agentRunId: chunk.agentRunId ?? runState.agentRunId,
							text: chunk.text,
							kind: chunk.kind,
						});
						updateImproveQuestionsProcess(questionId, (run) =>
							patchImproveQuestionsProcess(run, {
								agentRunState: { ...runState },
							}),
						);
					},
					onWorkspaceUpdate: ({ question: workspaceQuestion }) => {
						updateImproveQuestionsProcess(questionId, (run) =>
							patchImproveQuestionsProcess(run, {
								draftQuestion: draftToQuestionData(
									workspaceQuestion,
									run.originalSnapshot,
								),
							}),
						);
					},
					onDone: ({ finalQuestion }) => {
						updateImproveQuestionsProcess(questionId, (run) => {
							const finalDraft = draftToQuestionData(
								finalQuestion,
								run.originalSnapshot,
							);
							const nextAgentRunState = run.agentRunState
								? { ...run.agentRunState, status: "done" as const }
								: run.agentRunState;
							return patchImproveQuestionsProcess(run, {
								draftQuestion: finalDraft,
								changes: computeQuestionChanges(
									run.originalSnapshot,
									finalDraft,
								),
								agentRunState: nextAgentRunState,
								isStreaming: false,
								phase: "done",
							});
						});
						const finishedRun = getImproveQuestionsProcess(questionId);
						if (finishedRun) {
							maybeClearImproveQuestionsBatchConfig(finishedRun.examId);
						}
						runNextQueued();
					},
				},
			);
		} catch (error) {
			if (controller.signal.aborted || isAbortError(error)) {
				return;
			}
			const message = getErrorMessage(error);
			updateImproveQuestionsProcess(questionId, (run) =>
				patchImproveQuestionsProcess(run, {
					streamError: message,
					isStreaming: false,
					phase: "error",
					agentRunState: run.agentRunState
						? {
								...run.agentRunState,
								status: "error",
								error: message,
							}
						: run.agentRunState,
				}),
			);
			const erroredRun = getImproveQuestionsProcess(questionId);
			if (erroredRun) {
				maybeClearImproveQuestionsBatchConfig(erroredRun.examId);
			}
			runNextQueued();
		} finally {
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
		}
	})();
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

export async function applyImproveQuestionsRun(
	questionId: number,
	question: QuestionData,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const run = getImproveQuestionsProcess(questionId);
	if (!run) {
		return { ok: false, error: "No improve-questions run found." };
	}

	const resolved = {
		...resolveQuestion(run.originalSnapshot, run.draftQuestion, run.changes),
		scoringMode: question.scoringMode,
		deepExplanation: question.deepExplanation,
		topic: question.topic,
		exam_id: question.exam_id,
	};
	const payload = buildUpdatePayload(
		run.originalSnapshot,
		resolved,
		run.changes,
	);
	if (
		payload.question === undefined &&
		payload.options === undefined &&
		payload.answers === undefined &&
		payload.explanation === undefined
	) {
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
