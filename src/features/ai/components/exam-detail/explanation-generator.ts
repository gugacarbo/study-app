import type { ExplanationProgressItem } from "@/components/exam-detail/exam-utils";
import { getErrorMessage } from "@/components/exam-detail/exam-utils";
import type { ExplanationAgentRunSummary } from "@/features/ai/agents/explanations";
import { generateExamQuestionExplanations } from "@/server-functions/exams";

interface ExplanationGenerationResult {
	updatedQuestionIds?: number[];
	generatedResponses?: Array<{
		id: number;
		explanation: string;
		deepExplanation: string;
	}>;
	agentRuns?: ExplanationAgentRunSummary[];
}

export interface BatchProcessCallbacks {
	setAgentRuns: (
		updater: (
			prev: ExplanationAgentRunSummary[],
		) => ExplanationAgentRunSummary[],
	) => void;
	setProgressItems: (
		updater: (prev: ExplanationProgressItem[]) => ExplanationProgressItem[],
	) => void;
	setGenerationMessage: (msg: string) => void;
}

export async function processExplanationBatch(
	batchIds: number[],
	batchIndex: number,
	examId: number,
	callbacks: BatchProcessCallbacks,
): Promise<{
	updatedCount: number;
	failedCount: number;
	agentRuns: ExplanationAgentRunSummary[];
}> {
	const optimisticAgentRun: ExplanationAgentRunSummary = {
		agentRunId: `explanations-batch-${batchIndex + 1}:explanation-batch-1`,
		label: "Explanation batch 1",
		status: "running",
		systemPrompt: "",
		userPrompt: "",
		meta: {
			questionCount: batchIds.length,
			questionIds: batchIds,
		},
	};

	callbacks.setAgentRuns((prev) => {
		const next = new Map(
			prev.map((agentRun) => [agentRun.agentRunId, agentRun]),
		);
		next.set(optimisticAgentRun.agentRunId, optimisticAgentRun);
		return Array.from(next.values());
	});

	callbacks.setProgressItems((prev) =>
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

		callbacks.setAgentRuns((prev) => {
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

		const updatedCount = updatedIds.size;
		const failedCount = batchIds.filter((id) => !updatedIds.has(id)).length;

		callbacks.setProgressItems((prev) =>
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

		return { updatedCount, failedCount, agentRuns: result.agentRuns || [] };
	} catch (batchError) {
		const msg = getErrorMessage(batchError);
		const failedCount = batchIds.length;

		callbacks.setAgentRuns((prev) =>
			prev.map((agentRun) =>
				agentRun.agentRunId === optimisticAgentRun.agentRunId
					? { ...agentRun, status: "error", error: msg }
					: agentRun,
			),
		);
		callbacks.setProgressItems((prev) =>
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

		return { updatedCount: 0, failedCount, agentRuns: [] };
	}
}
