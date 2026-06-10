import type {
	ChangeDecision,
	ImproveOptionsAgentEvent,
	QuestionChange,
} from "@/features/ai/agents/improve-options/contracts";
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
} from "@/features/exams/components/detail/improve-options-dialog/diff-changes";
import { resolveQuestion } from "@/features/exams/components/detail/improve-options-dialog/resolve-question";
import { improveOptionsStream } from "@/lib/sse-stream/improve-options-stream";
import { queryClient } from "@/routes/__root";
import { updateQuestion } from "@/server-functions/exams";
import {
	cloneQuestion,
	draftToQuestionData,
} from "./question-helpers";
import { improveOptionsStore } from "./store";
import type { ImproveOptionsRun } from "./types";

const abortControllers = new Map<number, AbortController>();

function syncAgentRunId(
	state: AgentRunState,
	event: ImproveOptionsAgentEvent,
): AgentRunState {
	if (state.agentRunId === event.agentRunId) return state;
	return createAgentRunState({
		agentRunId: event.agentRunId,
		label: event.label,
		systemPrompt: event.systemPrompt,
		userPrompt: event.userPrompt,
	});
}

function updateRun(
	questionId: number,
	updater: (run: ImproveOptionsRun) => ImproveOptionsRun,
) {
	improveOptionsStore.setState((state) => {
		const run = state.runs[questionId];
		if (!run) return state;
		return {
			...state,
			runs: {
				...state.runs,
				[questionId]: updater(run),
			},
		};
	});
}

function setRun(questionId: number, run: ImproveOptionsRun) {
	improveOptionsStore.setState((state) => ({
		...state,
		runs: {
			...state.runs,
			[questionId]: run,
		},
	}));
}

function removeRun(questionId: number) {
	improveOptionsStore.setState((state) => {
		if (!state.runs[questionId]) return state;
		const { [questionId]: _removed, ...rest } = state.runs;
		return { ...state, runs: rest };
	});
}

function isAbortError(err: unknown): boolean {
	return err instanceof DOMException && err.name === "AbortError";
}

function buildUpdatePayload(
	original: QuestionData,
	resolved: QuestionData,
	changes: QuestionChange[],
): {
	options?: string[];
	answers?: string[];
	explanation?: string;
} {
	const payload: {
		options?: string[];
		answers?: string[];
		explanation?: string;
	} = {};

	const keepField = (field: QuestionChange["field"]) =>
		changes.some(
			(change) => change.field === field && change.decision !== "revert",
		);

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
		payload.options !== undefined ||
		payload.answers !== undefined ||
		payload.explanation !== undefined;

	if (!hasPayload) {
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

export function getImproveOptionsRun(
	questionId: number,
): ImproveOptionsRun | null {
	return improveOptionsStore.state.runs[questionId] ?? null;
}

export function hasRunningImproveOptionsRun(): boolean {
	return Object.values(improveOptionsStore.state.runs).some(
		(run) => run.isStreaming || run.phase === "running",
	);
}

export function startImproveOptionsRun(
	questionId: number,
	examId: number,
	question: QuestionData,
) {
	const existing = improveOptionsStore.state.runs[questionId];
	if (existing?.isStreaming || existing?.phase === "running") {
		return;
	}
	if (existing) {
		return;
	}

	const original = cloneQuestion(question);
	const initialRun: ImproveOptionsRun = {
		questionId,
		examId,
		originalSnapshot: original,
		draftQuestion: original,
		agentRunState: createAgentRunState({
			agentRunId: `improve-options-${questionId}`,
			label: "Improve options",
		}),
		changes: [],
		isStreaming: true,
		streamError: null,
		phase: "running",
	};
	setRun(questionId, initialRun);

	const controller = new AbortController();
	abortControllers.set(questionId, controller);

	void (async () => {
		let runState =
			improveOptionsStore.state.runs[questionId]?.agentRunState ??
			createAgentRunState({
				agentRunId: `improve-options-${questionId}`,
				label: "Improve options",
			});

		try {
			await improveOptionsStream(
				{ questionId, signal: controller.signal },
				{
					onAgent: (event) => {
						runState = syncAgentRunId(runState, event);
						runState = reduceAgentEvent(runState, event);
						updateRun(questionId, (run) => ({
							...run,
							agentRunState: { ...runState },
						}));
					},
					onChunk: (chunk) => {
						if (!chunk.text) return;
						runState = reduceAgentEvent(runState, {
							eventType: "text-chunk",
							agentRunId: chunk.agentRunId ?? runState.agentRunId,
							text: chunk.text,
							kind: chunk.kind,
						});
						updateRun(questionId, (run) => ({
							...run,
							agentRunState: { ...runState },
						}));
					},
					onWorkspaceUpdate: ({ question: workspaceQuestion }) => {
						updateRun(questionId, (run) => ({
							...run,
							draftQuestion: draftToQuestionData(
								workspaceQuestion,
								run.originalSnapshot,
							),
						}));
					},
					onDone: ({ finalQuestion }) => {
						updateRun(questionId, (run) => {
							const finalDraft = draftToQuestionData(
								finalQuestion,
								run.originalSnapshot,
							);
							const nextAgentRunState = run.agentRunState
								? { ...run.agentRunState, status: "done" as const }
								: run.agentRunState;
							return {
								...run,
								draftQuestion: finalDraft,
								changes: computeQuestionChanges(
									run.originalSnapshot,
									finalDraft,
								),
								agentRunState: nextAgentRunState,
								isStreaming: false,
								phase: "done",
							};
						});
					},
				},
			);
		} catch (error) {
			if (controller.signal.aborted || isAbortError(error)) {
				return;
			}
			const message = getErrorMessage(error);
			updateRun(questionId, (run) => ({
				...run,
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
			}));
		} finally {
			abortControllers.delete(questionId);
			const current = improveOptionsStore.state.runs[questionId];
			if (current?.isStreaming && !controller.signal.aborted) {
				updateRun(questionId, (run) => ({
					...run,
					isStreaming: false,
					phase: run.phase === "running" ? "done" : run.phase,
				}));
			}
		}
	})();
}

export function cancelImproveOptionsRun(questionId: number) {
	const controller = abortControllers.get(questionId);
	if (controller) {
		controller.abort();
		abortControllers.delete(questionId);
	}
	updateRun(questionId, (run) => ({
		...run,
		isStreaming: false,
		phase: "canceled",
	}));
	removeRun(questionId);
}

export function setImproveOptionsDecision(
	questionId: number,
	changeId: string,
	decision: ChangeDecision,
) {
	updateRun(questionId, (run) => ({
		...run,
		changes: run.changes.map((change) =>
			change.id === changeId ? { ...change, decision } : change,
		),
	}));
}

export function keepAllImproveOptionsChanges(questionId: number) {
	updateRun(questionId, (run) => ({
		...run,
		changes: applyDecisions(run.changes, "keep"),
	}));
}

export function revertAllImproveOptionsChanges(questionId: number) {
	updateRun(questionId, (run) => ({
		...run,
		changes: applyDecisions(run.changes, "revert"),
	}));
}

export async function applyImproveOptionsRun(
	questionId: number,
	question: QuestionData,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const run = improveOptionsStore.state.runs[questionId];
	if (!run) {
		return { ok: false, error: "No improve-options run found." };
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
		removeRun(questionId);
		return { ok: true };
	} catch (error) {
		const message = getErrorMessage(error);
		console.error("Failed to apply improve options:", error);
		updateRun(questionId, (run) => ({
			...run,
			streamError: message,
		}));
		return { ok: false, error: message };
	}
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
	if (!hasRunningImproveOptionsRun()) return;
	event.preventDefault();
	event.returnValue = "";
}

if (typeof window !== "undefined") {
	window.addEventListener("beforeunload", handleBeforeUnload);
}
