import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { generateExamQuestionExplanations } from "../../server-functions/exams";
import type {
	ExplanationProgressItem,
	ExplanationProgressStatus,
} from "./exam-utils";
import { getErrorMessage, chunkIds } from "./exam-utils";

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
	const [selectedResponseItemId, setSelectedResponseItemId] = useState<
		number | null
	>(null);

	const isComplete = (q: QuestionBrief) =>
		Boolean(q.explanation?.trim()) && Boolean(q.deepExplanation?.trim());
	const pendingExplanationCount = questions.filter(
		(q) => !q.explanation?.trim() || !q.deepExplanation?.trim(),
	).length;
	const questionOrder = new Map(questions.map((q, idx) => [q.id, idx + 1]));
	const buildProgressItems = (): ExplanationProgressItem[] =>
		questions.map((q) => ({
			id: q.id,
			question: q.question,
			status: (overwriteExplanations || !isComplete(q)
				? "pending"
				: "skipped") as ExplanationProgressStatus,
			message:
				overwriteExplanations || !isComplete(q)
					? "Aguardando"
					: "Já preenchida",
		}));

	useEffect(() => {
		if (!open || generatingExplanations) return;
		setProgressItems(buildProgressItems());
		setSelectedResponseItemId(null);
	}, [open, overwriteExplanations]);

	const handleGenerateExplanations = async () => {
		setGeneratingExplanations(true);
		setGenerationMessage(null);
		const initialProgress = buildProgressItems();
		setProgressItems(initialProgress);
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
					const result = await generateExamQuestionExplanations({
						data: {
							examId,
							overwrite: true,
							batchSize: batchIds.length,
							questionIds: batchIds,
						},
					});
					const updatedIds = new Set(result.updatedQuestionIds || []);
					const generatedById = new Map(
						(result.generatedResponses || []).map((i) => [i.id, i]),
					);
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
