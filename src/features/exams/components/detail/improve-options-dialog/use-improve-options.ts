import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
	ChangeDecision,
	DraftQuestion,
	ImproveOptionsAgentEvent,
	QuestionChange,
} from "@/features/ai/agents/improve-options/contracts";
import {
	createAgentRunState,
	reduceAgentEvent,
	type AgentRunState,
} from "@/features/ai/utils/agent-run-messages";
import { improveOptionsStream } from "@/lib/sse-stream/improve-options-stream";
import { updateQuestion } from "@/server-functions/exams";
import type { QuestionData } from "../exam-utils";
import { getErrorMessage } from "../exam-utils";
import {
	applyDecisions,
	computeQuestionChanges,
} from "./diff-changes";
import { resolveQuestion } from "./resolve-question";
import type { ImproveOptionsAgentStatus } from "./types";

type DraftLike = DraftQuestion & {
	answer?: string;
	answers?: string[];
};

export interface UseImproveOptionsParams {
	questionId: number;
	examId: number;
	open: boolean;
	question: QuestionData;
	onOpenChange: (open: boolean) => void;
}

function cloneQuestion(question: QuestionData): QuestionData {
	return {
		...question,
		options: [...question.options],
		answers: [...question.answers],
	};
}

function draftToQuestionData(draft: DraftLike, base: QuestionData): QuestionData {
	const answers =
		draft.answers && draft.answers.length > 0
			? [...draft.answers]
			: typeof draft.answer === "string" && draft.answer.trim()
				? [draft.answer]
				: [...base.answers];

	return {
		...base,
		id: draft.id,
		question: draft.question,
		options: [...draft.options],
		answers,
		scoringMode: draft.scoringMode ?? base.scoringMode,
		explanation: draft.explanation ?? base.explanation,
		...(draft.deepExplanation !== undefined
			? { deepExplanation: draft.deepExplanation }
			: {}),
		...(draft.topic !== undefined ? { topic: draft.topic } : {}),
	};
}

function mapRunStatusToUi(
	status: AgentRunState["status"] | null,
	streaming: boolean,
): ImproveOptionsAgentStatus {
	if (!status || status === "pending") {
		return streaming ? "running" : "idle";
	}
	if (status === "running") return "running";
	if (status === "done") return "done";
	if (status === "error") return "error";
	return "idle";
}

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

export function useImproveOptions({
	questionId,
	examId,
	open,
	question,
	onOpenChange,
}: UseImproveOptionsParams) {
	const queryClient = useQueryClient();
	const abortRef = useRef<AbortController | null>(null);
	const [originalSnapshot, setOriginalSnapshot] = useState<QuestionData | null>(
		null,
	);
	const [draftQuestion, setDraftQuestion] = useState<QuestionData | null>(null);
	const [agentRunState, setAgentRunState] = useState<AgentRunState | null>(
		null,
	);
	const [changes, setChanges] = useState<QuestionChange[]>([]);
	const [isStreaming, setIsStreaming] = useState(false);
	const [applying, setApplying] = useState(false);
	const [streamError, setStreamError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) {
			abortRef.current?.abort();
			abortRef.current = null;
			return;
		}

		const original = cloneQuestion(question);
		setOriginalSnapshot(original);
		setDraftQuestion(original);
		setChanges([]);
		setStreamError(null);
		setIsStreaming(true);

		const controller = new AbortController();
		abortRef.current = controller;

		let runState = createAgentRunState({
			agentRunId: `improve-options-${questionId}`,
			label: "Improve options",
		});
		setAgentRunState(runState);

		void (async () => {
			try {
				await improveOptionsStream(
					{ questionId, signal: controller.signal },
					{
						onAgent: (event) => {
							runState = syncAgentRunId(runState, event);
							runState = reduceAgentEvent(runState, event);
							setAgentRunState({ ...runState });
						},
						onChunk: (chunk) => {
							if (!chunk.text) return;
							runState = reduceAgentEvent(runState, {
								eventType: "text-chunk",
								agentRunId: chunk.agentRunId ?? runState.agentRunId,
								text: chunk.text,
								kind: chunk.kind,
							});
							setAgentRunState({ ...runState });
						},
						onWorkspaceUpdate: ({ question: workspaceQuestion }) => {
							setDraftQuestion(
								draftToQuestionData(workspaceQuestion, original),
							);
						},
						onDone: ({ finalQuestion }) => {
							const finalDraft = draftToQuestionData(finalQuestion, original);
							setDraftQuestion(finalDraft);
							setChanges(computeQuestionChanges(original, finalDraft));
							runState = {
								...runState,
								status: "done",
							};
							setAgentRunState({ ...runState });
						},
					},
				);
			} catch (error) {
				if (controller.signal.aborted) return;
				const message = getErrorMessage(error);
				setStreamError(message);
				runState = {
					...runState,
					status: "error",
					error: message,
				};
				setAgentRunState({ ...runState });
			} finally {
				if (!controller.signal.aborted) {
					setIsStreaming(false);
				}
			}
		})();

		return () => {
			controller.abort();
			if (abortRef.current === controller) {
				abortRef.current = null;
			}
		};
	}, [open, question, questionId]);

	const previewQuestion = useMemo(() => {
		if (!originalSnapshot || !draftQuestion) {
			return question;
		}
		if (changes.length === 0) {
			return draftQuestion;
		}
		return {
			...resolveQuestion(originalSnapshot, draftQuestion, changes),
			scoringMode: question.scoringMode,
			deepExplanation: question.deepExplanation,
			topic: question.topic,
			exam_id: question.exam_id,
		};
	}, [originalSnapshot, draftQuestion, changes, question]);

	const agentStatus = useMemo(
		() => mapRunStatusToUi(agentRunState?.status ?? null, isStreaming),
		[agentRunState?.status, isStreaming],
	);

	const handleDecision = useCallback((id: string, decision: ChangeDecision) => {
		setChanges((current) =>
			current.map((change) =>
				change.id === id ? { ...change, decision } : change,
			),
		);
	}, []);

	const handleKeepAll = useCallback(() => {
		setChanges((current) => applyDecisions(current, "keep"));
	}, []);

	const handleRevertAll = useCallback(() => {
		setChanges((current) => applyDecisions(current, "revert"));
	}, []);

	const handleCancel = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
		setIsStreaming(false);
		onOpenChange(false);
	}, [onOpenChange]);

	const handleApply = useCallback(async () => {
		if (!originalSnapshot || !draftQuestion) return;

		const resolved = {
			...resolveQuestion(originalSnapshot, draftQuestion, changes),
			scoringMode: question.scoringMode,
			deepExplanation: question.deepExplanation,
			topic: question.topic,
			exam_id: question.exam_id,
		};
		const payload = buildUpdatePayload(originalSnapshot, resolved, changes);
		if (
			payload.options === undefined &&
			payload.answers === undefined &&
			payload.explanation === undefined
		) {
			return;
		}

		setApplying(true);
		try {
			await updateQuestion({
				data: {
					id: questionId,
					...payload,
				},
			});
			await queryClient.invalidateQueries({
				queryKey: ["exam-detail", examId],
			});
			onOpenChange(false);
		} catch (error) {
			console.error("Failed to apply improve options:", error);
			setStreamError(getErrorMessage(error));
		} finally {
			setApplying(false);
		}
	}, [
		originalSnapshot,
		draftQuestion,
		changes,
		question,
		questionId,
		examId,
		queryClient,
		onOpenChange,
	]);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen) {
				abortRef.current?.abort();
				abortRef.current = null;
				setIsStreaming(false);
			}
			onOpenChange(nextOpen);
		},
		[onOpenChange],
	);

	return {
		question,
		draftQuestion: previewQuestion,
		messages: agentRunState?.messages ?? [],
		isStreaming,
		agentStatus,
		changes,
		streamError,
		onDecision: handleDecision,
		onKeepAll: handleKeepAll,
		onRevertAll: handleRevertAll,
		onApply: handleApply,
		onCancel: handleCancel,
		onOpenChange: handleOpenChange,
		applying,
	};
}
