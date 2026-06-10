import { useStore } from "@tanstack/react-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	backgroundProcessStore,
	explanationGenerationProcessId,
	isExplanationGenerationProcess,
	startExplanationGeneration,
} from "@/features/background-processes";
import type { ExplanationProgressItem } from "@/features/exams/components/detail/exam-utils";
import { buildProgressItems, computeProgressStats } from "./queue";

interface QuestionBrief {
	id: number;
	question: string;
	explanation: string;
	deepExplanation: string;
}

interface UseExplanationGenerationProps {
	examId: number;
	questions: QuestionBrief[];
	open: boolean;
}

function selectExplanationProcessForExam(
	state: typeof backgroundProcessStore.state,
	examId: number,
) {
	const candidate = state.processes.find(
		(process) => process.id === explanationGenerationProcessId(examId),
	);
	return candidate && isExplanationGenerationProcess(candidate)
		? candidate
		: null;
}

export function useExplanationGeneration({
	examId,
	questions,
	open,
}: UseExplanationGenerationProps) {
	const process = useStore(backgroundProcessStore, (state) =>
		selectExplanationProcessForExam(state, examId),
	);

	const [localBatchSize, setLocalBatchSize] = useState(8);
	const [localOverwriteExplanations, setLocalOverwriteExplanations] =
		useState(false);
	const [selectedResponseItemId, setSelectedResponseItemId] = useState<
		number | null
	>(null);

	const isGenerating =
		process?.status === "queued" || process?.status === "running";

	const batchSize = process?.batchSize ?? localBatchSize;
	const overwriteExplanations =
		process?.overwriteExplanations ?? localOverwriteExplanations;

	const idleProgressItems = useMemo(
		() => buildProgressItems(questions, overwriteExplanations),
		[questions, overwriteExplanations],
	);

	const progressItems: ExplanationProgressItem[] = isGenerating
		? (process?.progressItems ?? [])
		: idleProgressItems;

	const agentRuns = isGenerating ? (process?.agentRuns ?? []) : [];
	const generationMessage = process?.generationMessage ?? null;

	const pendingExplanationCount = questions.filter(
		(q) => !q.explanation?.trim() || !q.deepExplanation?.trim(),
	).length;
	const questionOrder = useMemo(
		() => new Map(questions.map((q, idx) => [q.id, idx + 1])),
		[questions],
	);

	const findAgentRunForQuestionId = useCallback(
		(questionId: number) =>
			agentRuns.find((agentRun) =>
				agentRun.meta?.questionIds?.includes(questionId),
			),
		[agentRuns],
	);

	useEffect(() => {
		if (!open || isGenerating) return;
		setSelectedResponseItemId(null);
	}, [open, isGenerating]);

	const setBatchSize = useCallback(
		(size: number) => {
			if (!isGenerating) setLocalBatchSize(size);
		},
		[isGenerating],
	);

	const setOverwriteExplanations = useCallback(
		(overwrite: boolean) => {
			if (!isGenerating) setLocalOverwriteExplanations(overwrite);
		},
		[isGenerating],
	);

	const handleGenerateExplanations = useCallback(() => {
		startExplanationGeneration(examId, {
			questions,
			batchSize: localBatchSize,
			overwriteExplanations: localOverwriteExplanations,
		});
	}, [examId, questions, localBatchSize, localOverwriteExplanations]);

	const stats = computeProgressStats(progressItems);

	return {
		generatingExplanations: isGenerating,
		overwriteExplanations,
		setOverwriteExplanations,
		batchSize,
		setBatchSize,
		generationMessage,
		progressItems,
		agentRuns,
		selectedResponseItemId,
		setSelectedResponseItemId,
		pendingExplanationCount,
		questionOrder,
		...stats,
		findAgentRunForQuestionId,
		selectedResponseItem: progressItems.find(
			(i) => i.id === selectedResponseItemId,
		),
		handleGenerateExplanations,
	};
}
