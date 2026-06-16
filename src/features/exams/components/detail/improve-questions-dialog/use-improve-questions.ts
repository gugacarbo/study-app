import { useStore } from "@tanstack/react-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeDecision } from "@/features/ai/agents/improve-questions/contracts";
import type { AgentRunState } from "@/features/ai/pipeline/client";
import {
	applyImproveQuestionsRun,
	backgroundProcessStore,
	canContinueImproveQuestionsRun,
	cancelImproveQuestionsRun,
	canSendImproveQuestionsFollowUp,
	continueImproveQuestionsRun,
	dismissImproveQuestionsRun,
	getImproveQuestionsRun,
	getRunPreviewQuestion,
	improveQuestionsProcessId,
	isImproveQuestionsProcess,
	keepAllImproveQuestionsChanges,
	revertAllImproveQuestionsChanges,
	sendImproveQuestionsFollowUp,
	setImproveQuestionsDecision,
	startImproveQuestionsRun,
} from "@/features/background-processes";
import type { QuestionData } from "../exam-utils";
import type { ImproveQuestionsAgentStatus } from "./types";

export interface UseImproveQuestionsParams {
	questionId: number;
	examId: number;
	open: boolean;
	question: QuestionData;
	onOpenChange: (open: boolean) => void;
}

function mapRunStatusToUi(
	status: AgentRunState["status"] | null,
	streaming: boolean,
): ImproveQuestionsAgentStatus {
	if (!status || status === "pending") {
		return streaming ? "running" : "idle";
	}
	if (status === "running") return "running";
	if (status === "done") return "done";
	if (status === "error") return "error";
	return "idle";
}

export function useImproveQuestions({
	questionId,
	examId,
	open,
	question,
	onOpenChange,
}: UseImproveQuestionsParams) {
	const run = useStore(backgroundProcessStore, (state) => {
		const process = state.processes.find(
			(candidate) => candidate.id === improveQuestionsProcessId(questionId),
		);
		return process && isImproveQuestionsProcess(process) ? process : undefined;
	});
	const [applying, setApplying] = useState(false);

	useEffect(() => {
		if (!open) return;
		if (getImproveQuestionsRun(questionId)) return;
		startImproveQuestionsRun(questionId, examId, question);
	}, [open, questionId, examId, question]);

	const previewQuestion = useMemo(() => {
		if (!run) return question;
		return getRunPreviewQuestion(run, question);
	}, [run, question]);

	const agentStatus = useMemo(
		() =>
			mapRunStatusToUi(
				run?.agentRunState?.status ?? null,
				run?.isStreaming ?? false,
			),
		[run?.agentRunState?.status, run?.isStreaming],
	);

	const canContinue = useMemo(
		() => canContinueImproveQuestionsRun(questionId),
		[questionId],
	);

	const canSendFollowUp = useMemo(
		() => canSendImproveQuestionsFollowUp(questionId),
		[questionId],
	);

	const streamError = useMemo(() => {
		if (run?.streamError) return run.streamError;
		if (run?.agentRunState?.error) return run.agentRunState.error;
		return null;
	}, [run?.streamError, run?.agentRunState?.error]);

	const handleDecision = useCallback(
		(id: string, decision: ChangeDecision) => {
			setImproveQuestionsDecision(questionId, id, decision);
		},
		[questionId],
	);

	const handleKeepAll = useCallback(() => {
		keepAllImproveQuestionsChanges(questionId);
	}, [questionId]);

	const handleRevertAll = useCallback(() => {
		revertAllImproveQuestionsChanges(questionId);
	}, [questionId]);

	const handleCancel = useCallback(() => {
		cancelImproveQuestionsRun(questionId);
		onOpenChange(false);
	}, [questionId, onOpenChange]);

	const handleDismiss = useCallback(() => {
		dismissImproveQuestionsRun(questionId);
		onOpenChange(false);
	}, [questionId, onOpenChange]);

	const handleContinue = useCallback(() => {
		continueImproveQuestionsRun(questionId);
	}, [questionId]);

	const handleSendFollowUp = useCallback(
		(message: string) => {
			sendImproveQuestionsFollowUp(questionId, message);
		},
		[questionId],
	);

	const handleApply = useCallback(async () => {
		setApplying(true);
		try {
			const result = await applyImproveQuestionsRun(questionId, question);
			if (result.ok) {
				onOpenChange(false);
			}
		} finally {
			setApplying(false);
		}
	}, [questionId, question, onOpenChange]);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			onOpenChange(nextOpen);
		},
		[onOpenChange],
	);

	return {
		question,
		draftQuestion: previewQuestion,
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
		onSendFollowUp: handleSendFollowUp,
		onOpenChange: handleOpenChange,
		canContinue,
		canSendFollowUp,
		applying,
	};
}
