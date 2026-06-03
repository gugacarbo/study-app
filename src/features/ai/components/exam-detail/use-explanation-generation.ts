import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type {
	ExplanationProgressItem,
	ExplanationProgressStatus,
} from "@/components/exam-detail/exam-utils";
import { chunkIds, getErrorMessage } from "@/components/exam-detail/exam-utils";
import type { ExplanationAgentRunSummary } from "@/features/ai/agents/explanations";
import { generateExamQuestionExplanations } from "@/server-functions/exams";

interface QuestionBrief {
	id: number;
	question: string;
	explanation: string;
	deepExplanation: string;
}

interface ExplanationGenerationResult {
	updatedQuestionIds?: number[];
	generatedResponses?: Array<{
		id: number;
		explanation: string;
		deepExplanation: string;
	}>;
	agentRuns?: ExplanationAgentRunSummary[];
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
	const buildProgressItems = useCallback(
		(): ExplanationProgressItem[] =>
			questions.map((q) => ({
				id: q.id,
				question: q.question,
				status: (overwriteExplanations ||
				!(Boolean(q.explanation?.trim()) && Boolean(q.deepExplanation?.trim()))
					? "pending"
					: "skipped") as ExplanationProgressStatus,
				message:
					overwriteExplanations ||
					!(
						Boolean(q.explanation?.trim()) && Boolean(q.deepExplanation?.trim())
					)
						? "Aguardando"
						: "Já preenchida",
			})),
		[questions, overwriteExplanations],
	);

	useEffect(() => {
		if (!open || generatingExplanations) return;
		setProgressItems(buildProgressItems());
		setAgentRuns([]);
		setSelectedResponseItemId(null);
	}, [open, generatingExplanations, buildProgressItems]);

	const handleGenerateExplanations = async () => {
		setGeneratingExplanations(true);
		setGenerationMessage(null);
		const initialProgress = buildProgressItems();
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
			for (const batchIds of idBatches) {
				setProgressItems((prev) =>
					prev.map((item) =>
						batchIds.includes(item.id)
							? { ...item, status: "processing", message: "Gerando..." }
							: item,
					),
				);
				try {
					const result = (await generateExamQuestionExplanations({
						data: {
							examId,
							overwrite: true,
							batchSize: batchIds.length,
							questionIds: batchIds,
						},
					})) as ExplanationGenerationResult;
					const updatedIds = new Set(result.updatedQuestionIds || []);
					const generatedById = new Map(
						(result.generatedResponses || []).map((i) => [i.id, i]),
					);
					setAgentRuns((prev) => {
						const next = new Map(
							prev.map((agentRun) => [agentRun.agentRunId, agentRun]),
						);
						for (const agentRun of result.agentRuns || []) {
							next.set(agentRun.agentRunId, agentRun);
						}
						return Array.from(next.values());
					});
					const successfulAgentRun =
						(result.agentRuns || []).find(
							(run: ExplanationAgentRunSummary) => run.status === "done",
						) ?? null;
					updatedCount += updatedIds.size;
					failedCount += batchIds.filter((id) => !updatedIds.has(id)).length;
					setProgressItems((prev) =>
						prev.map((item) => {
							if (!batchIds.includes(item.id)) return item;
							if (updatedIds.has(item.id)) {
								const gen = generatedById.get(item.id);
								return {
									...item,
									status: "done",
									message: "Concluída",
									response: gen
										? {
												explanation: gen.explanation,
												deepExplanation: gen.deepExplanation,
												agentRun: successfulAgentRun ?? undefined,
											}
										: undefined,
								};
							}
							return {
								...item,
								status: "error",
								message: "Sem retorno",
							} as ExplanationProgressItem;
						}),
					);
				} catch (batchError) {
					failedCount += batchIds.length;
					const msg = getErrorMessage(batchError);
					setProgressItems((prev) =>
						prev.map((item) =>
							batchIds.includes(item.id)
								? ({
										...item,
										status: "error",
										message: msg,
									} as ExplanationProgressItem)
								: item,
						),
					);
				}
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

	const processingCount = progressItems.filter(
		(i) => i.status === "processing",
	).length;
	const doneCount = progressItems.filter(
		(i) => i.status === "done" || i.status === "skipped",
	).length;
	const errorCount = progressItems.filter((i) => i.status === "error").length;
	const finishedCount = doneCount + errorCount;
	const progressPercent =
		progressItems.length > 0
			? Math.round((finishedCount / progressItems.length) * 100)
			: 0;

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
		processingCount,
		doneCount,
		errorCount,
		finishedCount,
		progressPercent,
		selectedResponseItem: progressItems.find(
			(i) => i.id === selectedResponseItemId,
		),
		handleGenerateExplanations,
	};
}
