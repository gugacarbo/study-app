import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { ExplanationProgressItem } from "@/components/exam-detail/exam-utils";
import { chunkIds, getErrorMessage } from "@/components/exam-detail/exam-utils";
import type { ExplanationAgentRunSummary } from "@/features/ai/agents/explanations";
import { processExplanationBatch } from "./generator";
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

export function useExplanationGeneration({
	examId,
	questions,
	open,
}: UseExplanationGenerationProps) {
	const queryClient = useQueryClient();
	const [generatingExplanations, setGeneratingExplanations] = useState(false);
	const [overwriteExplanations, setOverwriteExplanations] = useState(false);
	const [batchSize, setBatchSize] = useState(8);
	const [generationMessage, setGenerationMessage] = useState<string | null>(
		null,
	);
	const [progressItems, setProgressItems] = useState<ExplanationProgressItem[]>(
		[],
	);
	const [agentRuns, setAgentRuns] = useState<ExplanationAgentRunSummary[]>([]);
	const [selectedResponseItemId, setSelectedResponseItemId] = useState<
		number | null
	>(null);

	const pendingExplanationCount = questions.filter(
		(q) => !q.explanation?.trim() || !q.deepExplanation?.trim(),
	).length;
	const questionOrder = new Map(questions.map((q, idx) => [q.id, idx + 1]));

	const initProgress = useCallback(
		() => buildProgressItems(questions, overwriteExplanations),
		[questions, overwriteExplanations],
	);

	const findAgentRunForQuestionId = useCallback(
		(questionId: number) =>
			agentRuns.find((agentRun) =>
				agentRun.meta?.questionIds.includes(questionId),
			),
		[agentRuns],
	);

	useEffect(() => {
		if (!open || generatingExplanations) return;
		setProgressItems(initProgress());
		setAgentRuns([]);
		setSelectedResponseItemId(null);
	}, [open, generatingExplanations, initProgress]);

	const handleGenerateExplanations = async () => {
		setGeneratingExplanations(true);
		setGenerationMessage(null);
		const initialProgress = initProgress();
		setProgressItems(initialProgress);
		setAgentRuns([]);
		const targetIds = initialProgress
			.filter((item) => item.status === "pending")
			.map((item) => item.id);
		if (targetIds.length === 0) {
			setGenerationMessage("Nenhuma pergunta precisa de geração.");
			setGeneratingExplanations(false);
			return;
		}
		const idBatches = chunkIds(targetIds, batchSize);
		let updatedCount = 0;
		let failedCount = 0;
		try {
			for (const [batchIndex, batchIds] of idBatches.entries()) {
				const result = await processExplanationBatch(
					batchIds,
					batchIndex,
					examId,
					{ setAgentRuns, setProgressItems, setGenerationMessage },
				);
				updatedCount += result.updatedCount;
				failedCount += result.failedCount;
			}
			setGenerationMessage(
				failedCount > 0
					? `Concluído com alertas: ${updatedCount} atualizadas, ${failedCount} com erro.`
					: `Concluído: ${updatedCount} perguntas atualizadas.`,
			);
			if (updatedCount > 0)
				queryClient.invalidateQueries({ queryKey: ["exam-detail", examId] });
		} catch (err) {
			console.error("Failed to generate explanations:", err);
			setGenerationMessage(
				`Falha ao gerar explicações: ${getErrorMessage(err)}`,
			);
		} finally {
			setGeneratingExplanations(false);
		}
	};

	const stats = computeProgressStats(progressItems);

	return {
		generatingExplanations,
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
