import { useStore } from "@tanstack/react-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	applyAllReadyImproveQuestionsRuns,
	areImproveQuestionsExamViewsEqual,
	backgroundProcessStore,
	canApplyImproveQuestionsRun,
	clearImproveQuestionsBatch,
	continueImproveQuestionsRun,
	selectImproveQuestionsExamViews,
	startImproveQuestionsBatch,
} from "@/features/background-processes";
import type { QuestionData } from "../exam-utils";
import {
	type ImproveQuestionsBatchAgentItem,
	mapProcessViewToDisplayStatus,
} from "./types";

export interface UseImproveQuestionsBatchParams {
	examId: number;
	questions: QuestionData[];
	open: boolean;
}

export function useImproveQuestionsBatch({
	examId,
	questions,
	open,
}: UseImproveQuestionsBatchParams) {
	const [selectAll, setSelectAll] = useState(true);
	const [selectedIds, setSelectedIds] = useState<Set<number>>(
		() => new Set(questions.map((q) => q.id)),
	);
	const [maxWorkers, setMaxWorkers] = useState(3);
	const [applyingAll, setApplyingAll] = useState(false);

	const examProcessViews = useStore(
		backgroundProcessStore,
		(state) => selectImproveQuestionsExamViews(state, examId),
		areImproveQuestionsExamViewsEqual,
	);

	const questionIndexById = useMemo(() => {
		const map = new Map<number, number>();
		for (const [index, question] of questions.entries()) {
			map.set(question.id, index);
		}
		return map;
	}, [questions]);

	const agentItems = useMemo((): ImproveQuestionsBatchAgentItem[] => {
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
			.filter((item): item is ImproveQuestionsBatchAgentItem => item != null)
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

	const showAgentPanel = agentItems.length > 0;

	const isBatchComplete = useMemo(
		() => showAgentPanel && !isBatchRunning,
		[showAgentPanel, isBatchRunning],
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

	const readyToApplyCount = useMemo(
		() =>
			agentItems.filter(
				(item) =>
					item.displayStatus === "done" &&
					canApplyImproveQuestionsRun(item.question.id, item.question),
			).length,
		[agentItems],
	);

	const progressPercent =
		agentItems.length === 0
			? 0
			: Math.round((finishedCount / agentItems.length) * 100);

	useEffect(() => {
		if (!open) return;
		setSelectAll(true);
		setSelectedIds(new Set(questions.map((q) => q.id)));
	}, [open, questions]);

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
			setSelectedIds(checked ? new Set(questions.map((q) => q.id)) : new Set());
		},
		[questions],
	);

	const selectedQuestions = useMemo(
		() => questions.filter((q) => selectedIds.has(q.id)),
		[questions, selectedIds],
	);

	const handleStart = useCallback(() => {
		if (selectedQuestions.length === 0 || isBatchRunning) return;
		startImproveQuestionsBatch(examId, selectedQuestions, maxWorkers);
	}, [examId, selectedQuestions, maxWorkers, isBatchRunning]);

	const handleContinue = useCallback((questionId: number) => {
		continueImproveQuestionsRun(questionId);
	}, []);

	const handleApplyAll = useCallback(async () => {
		if (applyingAll || readyToApplyCount === 0) return;
		setApplyingAll(true);
		try {
			const readyQuestions = agentItems
				.filter(
					(item) =>
						item.displayStatus === "done" &&
						canApplyImproveQuestionsRun(item.question.id, item.question),
				)
				.map((item) => item.question);
			await applyAllReadyImproveQuestionsRuns(readyQuestions);
		} finally {
			setApplyingAll(false);
		}
	}, [agentItems, applyingAll, readyToApplyCount]);

	const handleClear = useCallback(() => {
		clearImproveQuestionsBatch(examId);
	}, [examId]);

	return {
		selectAll,
		selectedIds,
		selectedCount: selectedIds.size,
		maxWorkers,
		setMaxWorkers,
		toggleQuestion,
		handleSelectAll,
		handleStart,
		handleContinue,
		handleApplyAll,
		handleClear,
		applyingAll,
		readyToApplyCount,
		agentItems,
		isBatchRunning,
		isBatchComplete,
		showAgentPanel,
		finishedCount,
		processingCount,
		errorCount,
		progressPercent,
	};
}
