import { useStore } from "@tanstack/react-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	backgroundProcessStore,
	isImproveQuestionsProcess,
	startImproveQuestionsBatch,
} from "@/features/background-processes";
import type { QuestionData } from "../exam-utils";
import {
	type ImproveQuestionsBatchAgentItem,
	mapProcessToDisplayStatus,
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
	const [batchSize, setBatchSize] = useState(3);

	const examProcesses = useStore(backgroundProcessStore, (state) =>
		state.processes.filter(isImproveQuestionsProcess).filter(
			(process) => process.examId === examId,
		),
	);

	const questionIndexById = useMemo(() => {
		const map = new Map<number, number>();
		for (const [index, question] of questions.entries()) {
			map.set(question.id, index);
		}
		return map;
	}, [questions]);

	const agentItems = useMemo((): ImproveQuestionsBatchAgentItem[] => {
		return examProcesses
			.map((process) => {
				const question = questions.find((q) => q.id === process.questionId);
				if (!question) return null;
				return {
					process,
					question,
					questionIndex: questionIndexById.get(question.id) ?? 0,
					displayStatus: mapProcessToDisplayStatus(process),
				};
			})
			.filter((item): item is ImproveQuestionsBatchAgentItem => item != null)
			.sort((left, right) => left.questionIndex - right.questionIndex);
	}, [examProcesses, questions, questionIndexById]);

	const isBatchRunning = useMemo(
		() =>
			examProcesses.some(
				(process) =>
					process.status === "queued" ||
					process.status === "running" ||
					process.isStreaming,
			),
		[examProcesses],
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
			setSelectedIds(
				checked ? new Set(questions.map((q) => q.id)) : new Set(),
			);
		},
		[questions],
	);

	const selectedQuestions = useMemo(
		() => questions.filter((q) => selectedIds.has(q.id)),
		[questions, selectedIds],
	);

	const handleStart = useCallback(() => {
		if (selectedQuestions.length === 0 || isBatchRunning) return;
		startImproveQuestionsBatch(examId, selectedQuestions, batchSize);
	}, [examId, selectedQuestions, batchSize, isBatchRunning]);

	return {
		selectAll,
		selectedIds,
		selectedCount: selectedIds.size,
		batchSize,
		setBatchSize,
		toggleQuestion,
		handleSelectAll,
		handleStart,
		agentItems,
		isBatchRunning,
		finishedCount,
		processingCount,
		errorCount,
		progressPercent,
		hasAgents: agentItems.length > 0,
	};
}
