import { useStore } from "@tanstack/react-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeDecision } from "@/features/ai/agents/improve-options/contracts";
import type { AgentRunState } from "@/features/ai/utils/agent-run-messages";
import {
	applyImproveOptionsRun,
	cancelImproveOptionsRun,
	getImproveOptionsRun,
	getRunPreviewQuestion,
	keepAllImproveOptionsChanges,
	improveOptionsStore,
	revertAllImproveOptionsChanges,
	setImproveOptionsDecision,
	startImproveOptionsRun,
} from "@/features/exams/store/improve-options-store";
import type { QuestionData } from "../exam-utils";
import type { ImproveOptionsAgentStatus } from "./types";

export interface UseImproveOptionsParams {
	questionId: number;
	examId: number;
	open: boolean;
	question: QuestionData;
	onOpenChange: (open: boolean) => void;
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

export function useImproveOptions({
	questionId,
	examId,
	open,
	question,
	onOpenChange,
}: UseImproveOptionsParams) {
	const run = useStore(improveOptionsStore, (state) => state.runs[questionId]);
	const [applying, setApplying] = useState(false);

	useEffect(() => {
		if (!open) return;
		if (getImproveOptionsRun(questionId)) return;
		startImproveOptionsRun(questionId, examId, question);
	}, [open, questionId, examId, question]);

	const previewQuestion = useMemo(() => {
		if (!run) return question;
		return getRunPreviewQuestion(run, question);
	}, [run, question]);

	const agentStatus = useMemo(
		() => mapRunStatusToUi(run?.agentRunState?.status ?? null, run?.isStreaming ?? false),
		[run?.agentRunState?.status, run?.isStreaming],
	);

	const handleDecision = useCallback(
		(id: string, decision: ChangeDecision) => {
			setImproveOptionsDecision(questionId, id, decision);
		},
		[questionId],
	);

	const handleKeepAll = useCallback(() => {
		keepAllImproveOptionsChanges(questionId);
	}, [questionId]);

	const handleRevertAll = useCallback(() => {
		revertAllImproveOptionsChanges(questionId);
	}, [questionId]);

	const handleCancel = useCallback(() => {
		cancelImproveOptionsRun(questionId);
		onOpenChange(false);
	}, [questionId, onOpenChange]);

	const handleApply = useCallback(async () => {
		setApplying(true);
		try {
			const result = await applyImproveOptionsRun(questionId, question);
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
		streamError: run?.streamError ?? null,
		onDecision: handleDecision,
		onKeepAll: handleKeepAll,
		onRevertAll: handleRevertAll,
		onApply: handleApply,
		onCancel: handleCancel,
		onOpenChange: handleOpenChange,
		applying,
	};
}
