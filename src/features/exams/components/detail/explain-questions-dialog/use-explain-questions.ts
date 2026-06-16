import { useStore } from "@tanstack/react-store";
import { useCallback, useMemo, useState } from "react";
import type { ChangeDecision } from "@/features/ai/agents/improve-questions/contracts";
import type { AgentRunState } from "@/features/ai/utils/agent-run-messages";
import {
	applyExplainQuestionRun,
	backgroundProcessStore,
	cancelExplainQuestionRun,
	canContinueExplainQuestionRun,
	continueExplainQuestionRun,
	dismissExplainQuestionRun,
	explainQuestionProcessId,
	getRunPreviewExplanations,
	isExplainQuestionProcess,
	keepAllExplainQuestionChanges,
	revertAllExplainQuestionChanges,
	setExplainQuestionDecision,
} from "@/features/background-processes";
import type { QuestionData } from "../exam-utils";
import type { ExplainQuestionsAgentStatus } from "./types";

export interface UseExplainQuestionsParams {
	questionId: number;
	examId: number;
	open: boolean;
	question: QuestionData;
	onOpenChange: (open: boolean) => void;
}

function mapRunStatusToUi(
	status: AgentRunState["status"] | null,
	streaming: boolean,
): ExplainQuestionsAgentStatus {
	if (streaming || status === "running") return "running";
	if (status === "done") return "done";
	if (status === "error") return "error";
	return "idle";
}

export function useExplainQuestions({
	questionId,
	examId: _examId,
	open: _open,
	question,
	onOpenChange,
}: UseExplainQuestionsParams) {
	const run = useStore(backgroundProcessStore, (state) => {
		const process = state.processes.find(
			(candidate) => candidate.id === explainQuestionProcessId(questionId),
		);
		return process && isExplainQuestionProcess(process) ? process : undefined;
	});
	const [applying, setApplying] = useState(false);

	const preview = useMemo(() => {
		if (!run) {
			return {
				explanation: question.explanation,
				deepExplanation: question.deepExplanation,
			};
		}
		return getRunPreviewExplanations(run);
	}, [run, question]);

	const agentStatus = useMemo(
		() => mapRunStatusToUi(run?.agentRunState?.status ?? null, run?.isStreaming ?? false),
		[run?.agentRunState?.status, run?.isStreaming],
	);

	const canContinue = useMemo(
		() => canContinueExplainQuestionRun(questionId),
		[questionId, run],
	);

	const streamError = useMemo(() => {
		if (run?.streamError) return run.streamError;
		if (run?.agentRunState?.error) return run.agentRunState.error;
		return null;
	}, [run?.streamError, run?.agentRunState?.error]);

	const handleDecision = useCallback(
		(id: string, decision: ChangeDecision) => {
			setExplainQuestionDecision(questionId, id, decision);
		},
		[questionId],
	);

	const handleKeepAll = useCallback(() => {
		keepAllExplainQuestionChanges(questionId);
	}, [questionId]);

	const handleRevertAll = useCallback(() => {
		revertAllExplainQuestionChanges(questionId);
	}, [questionId]);

	const handleCancel = useCallback(() => {
		cancelExplainQuestionRun(questionId);
		onOpenChange(false);
	}, [questionId, onOpenChange]);

	const handleDismiss = useCallback(() => {
		dismissExplainQuestionRun(questionId);
		onOpenChange(false);
	}, [questionId, onOpenChange]);

	const handleContinue = useCallback(() => {
		continueExplainQuestionRun(questionId);
	}, [questionId]);

	const handleApply = useCallback(async () => {
		setApplying(true);
		try {
			const result = await applyExplainQuestionRun(questionId);
			if (result.ok) {
				onOpenChange(false);
			}
		} finally {
			setApplying(false);
		}
	}, [questionId, onOpenChange]);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			onOpenChange(nextOpen);
		},
		[onOpenChange],
	);

	return {
		question,
		preview,
		messages: run?.agentRunState?.messages ?? [],
		isStreaming: run?.isStreaming ?? false,
		agentStatus,
		changes: run?.changes ?? [],
		streamError,
		onDecision: handleDecision,
		onKeepAll: handleKeepAll,
		onRevertAll: handleRevertAll,
		onApply: handleApply,
		onCancel: handleCancel,
		onDismiss: handleDismiss,
		onContinue: handleContinue,
		onOpenChange: handleOpenChange,
		canContinue,
		applying,
	};
}
