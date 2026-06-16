import { useStore } from "@tanstack/react-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	areExplainQuestionsExamViewsEqual,
	backgroundProcessStore,
	cancelExplainQuestionsBatch,
	continueExplainQuestionRun,
	getExplainQuestionRun,
	questionNeedsExplanation,
	selectExplainQuestionsExamViews,
	startExplainQuestionsBatch,
} from "@/features/background-processes";
import type { QuestionData } from "../exam-utils";
import {
	type ExplainQuestionsBatchAgentItem,
	mapProcessViewToDisplayStatus,
} from "./types";

export interface UseExplainQuestionsBatchParams {
	examId: number;
	questions: QuestionData[];
	open: boolean;
}

export function useExplainQuestionsBatch({
	examId,
	questions,
	open,
}: UseExplainQuestionsBatchParams) {
	const [selectAll, setSelectAll] = useState(true);
	const [selectedIds, setSelectedIds] = useState<Set<number>>(() => {
		const eligible = questions.filter((q) => questionNeedsExplanation(q, false));
		return new Set(eligible.map((q) => q.id));
	});
	const [maxWorkers, setMaxWorkers] = useState(3);
	const [overwriteExplanations, setOverwriteExplanations] = useState(false);

	const examProcessViews = useStore(
		backgroundProcessStore,
		(state) => selectExplainQuestionsExamViews(state, examId),
		areExplainQuestionsExamViewsEqual,
	);

	const questionIndexById = useMemo(() => {
		const map = new Map<number, number>();
		for (const [index, question] of questions.entries()) {
			map.set(question.id, index);
		}
		return map;
	}, [questions]);

	const agentItems = useMemo((): ExplainQuestionsBatchAgentItem[] => {
		return examProcessViews
			.map((processView) => {
				const question = questions.find((q) => q.id === processView.questionId);
				if (!question) return null;
				return {
					processView,
					question,
					questionIndex: questionIndexById.get(question.id) ?? 0,
					displayStatus: mapProcessViewToDisplayStatus(processView),
				};
			})
			.filter((item): item is ExplainQuestionsBatchAgentItem => item != null)
			.sort((left, right) => left.questionIndex - right.questionIndex);
	}, [examProcessViews, questions, questionIndexById]);

	const isBatchRunning = useMemo(
		() =>
			examProcessViews.some(
				(view) =>
					view.isStreaming ||
					view.status === "running" ||
					view.status === "queued",
			),
		[examProcessViews],
	);

	const showAgentPanel = useMemo(
		() =>
			isBatchRunning ||
			agentItems.some((item) => item.displayStatus !== "done"),
		[isBatchRunning, agentItems],
	);

	const finishedCount = useMemo(
		() =>
			agentItems.filter(
				(item) =>
					item.displayStatus === "done" ||
					item.displayStatus === "error" ||
					item.displayStatus === "canceled",
			).length,
		[agentItems],
	);

	const processingCount = useMemo(
		() => agentItems.filter((item) => item.displayStatus === "running").length,
		[agentItems],
	);

	const errorCount = useMemo(
		() => agentItems.filter((item) => item.displayStatus === "error").length,
		[agentItems],
	);

	const progressPercent =
		agentItems.length === 0
			? 0
			: Math.round((finishedCount / agentItems.length) * 100);

	useEffect(() => {
		if (!open) return;
		const eligible = questions.filter((q) => questionNeedsExplanation(q, false));
		setSelectAll(true);
		setSelectedIds(new Set(eligible.map((q) => q.id)));
	}, [open, questions]);

	const pendingExplanationCount = useMemo(
		() =>
			questions.filter((q) => questionNeedsExplanation(q, overwriteExplanations))
				.length,
		[questions, overwriteExplanations],
	);

	const toggleQuestion = useCallback((questionId: number, checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) next.add(questionId);
			else next.delete(questionId);
			return next;
		});
		setSelectAll(false);
	}, []);

	const handleSelectAll = useCallback(
		(checked: boolean) => {
			setSelectAll(checked);
			const eligible = questions.filter((q) =>
				questionNeedsExplanation(q, overwriteExplanations),
			);
			setSelectedIds(
				checked ? new Set(eligible.map((q) => q.id)) : new Set(),
			);
		},
		[questions, overwriteExplanations],
	);

	const selectedQuestions = useMemo(
		() =>
			questions.filter(
				(q) =>
					selectedIds.has(q.id) &&
					questionNeedsExplanation(q, overwriteExplanations),
			),
		[questions, selectedIds, overwriteExplanations],
	);

	const handleStart = useCallback(() => {
		if (selectedQuestions.length === 0 || isBatchRunning) return;
		startExplainQuestionsBatch(
			examId,
			selectedQuestions,
			maxWorkers,
			overwriteExplanations,
		);
	}, [
		examId,
		selectedQuestions,
		maxWorkers,
		overwriteExplanations,
		isBatchRunning,
	]);

	const handleContinue = useCallback((questionId: number) => {
		continueExplainQuestionRun(questionId);
	}, []);

	const handleCancel = useCallback(() => {
		cancelExplainQuestionsBatch(examId);
	}, [examId]);

	const getAgentRunForQuestion = useCallback((questionId: number) => {
		return getExplainQuestionRun(questionId)?.agentRunState ?? null;
	}, []);

	return {
		selectAll,
		selectedIds,
		selectedCount: selectedIds.size,
		maxWorkers,
		setMaxWorkers,
		overwriteExplanations,
		setOverwriteExplanations,
		toggleQuestion,
		handleSelectAll,
		handleStart,
		handleContinue,
		handleCancel,
		getAgentRunForQuestion,
		agentItems,
		isBatchRunning,
		showAgentPanel,
		finishedCount,
		processingCount,
		errorCount,
		progressPercent,
		pendingExplanationCount,
	};
}
