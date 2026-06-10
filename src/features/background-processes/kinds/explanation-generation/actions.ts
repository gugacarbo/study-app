import type { ExplanationAgentRunSummary } from "@/features/ai/agents/explanations";
import { processExplanationBatch } from "@/features/ai/components/exam-detail/explanation-generation/generator";
import { buildProgressItems } from "@/features/ai/components/exam-detail/explanation-generation/queue";
import type { ExplanationProgressItem } from "@/features/exams/components/detail/exam-utils";
import {
	chunkIds,
	getErrorMessage,
} from "@/features/exams/components/detail/exam-utils";
import { queryClient } from "@/routes/__root";
import {
	getAbortController,
	registerAbort,
	unregisterAbort,
} from "../../store/registry";
import { runNextQueued } from "../../store/scheduler";
import { getProcessById, updateProcess, upsertProcess } from "../../store/store";
import type { ExplanationGenerationBackgroundProcess } from "../../store/types";
import {
	explanationGenerationProcessId,
	isExplanationGenerationProcess,
} from "../../store/types";
import type { StartExplanationGenerationOptions } from "./types";

function isAbortError(err: unknown): boolean {
	return err instanceof DOMException && err.name === "AbortError";
}

function makeBatchCallbacks(processId: string) {
	return {
		setAgentRuns: (
			updater: (
				prev: ExplanationAgentRunSummary[],
			) => ExplanationAgentRunSummary[],
		) => {
			updateProcess(processId, (process) => {
				if (!isExplanationGenerationProcess(process)) return process;
				return { ...process, agentRuns: updater(process.agentRuns) };
			});
		},
		setProgressItems: (
			updater: (prev: ExplanationProgressItem[]) => ExplanationProgressItem[],
		) => {
			updateProcess(processId, (process) => {
				if (!isExplanationGenerationProcess(process)) return process;
				return { ...process, progressItems: updater(process.progressItems) };
			});
		},
		setGenerationMessage: (message: string) => {
			updateProcess(processId, (process) => {
				if (!isExplanationGenerationProcess(process)) return process;
				return { ...process, generationMessage: message };
			});
		},
	};
}

function finishProcess(
	processId: string,
	patch: Partial<
		Pick<
			ExplanationGenerationBackgroundProcess,
			"status" | "generationMessage" | "finishedAt"
		>
	>,
): void {
	updateProcess(processId, (process) => {
		if (!isExplanationGenerationProcess(process)) return process;
		return {
			...process,
			...patch,
			finishedAt: patch.finishedAt ?? Date.now(),
		};
	});
}

async function runExplanationGeneration(processId: string): Promise<void> {
	const initial = getProcessById(processId);
	if (!initial || !isExplanationGenerationProcess(initial)) return;
	if (initial.status !== "queued") return;

	const abortController = new AbortController();
	registerAbort(processId, abortController);
	const { signal } = abortController;

	const { examId, batchSize, overwriteExplanations, questions } = initial;

	updateProcess(processId, (process) => {
		if (!isExplanationGenerationProcess(process)) return process;
		return {
			...process,
			status: "running",
			startedAt: Date.now(),
			progressItems: buildProgressItems(questions, overwriteExplanations),
			agentRuns: [],
			generationMessage: null,
		};
	});

	const callbacks = makeBatchCallbacks(processId);
	const progressItems = buildProgressItems(questions, overwriteExplanations);
	const targetIds = progressItems
		.filter((item) => item.status === "pending")
		.map((item) => item.id);

	if (targetIds.length === 0) {
		finishProcess(processId, {
			status: "success",
			generationMessage: "Nenhuma pergunta precisa de geração.",
		});
		unregisterAbort(processId);
		runNextQueued();
		return;
	}

	const idBatches = chunkIds(targetIds, batchSize);
	let updatedCount = 0;
	let failedCount = 0;

	try {
		for (const [batchIndex, batchIds] of idBatches.entries()) {
			if (signal.aborted) {
				finishProcess(processId, {
					status: "canceled",
					generationMessage: "Cancelado.",
				});
				return;
			}

			const result = await processExplanationBatch(
				batchIds,
				batchIndex,
				examId,
				callbacks,
			);
			updatedCount += result.updatedCount;
			failedCount += result.failedCount;

			if (signal.aborted) {
				finishProcess(processId, {
					status: "canceled",
					generationMessage: "Cancelado.",
				});
				return;
			}
		}

		const message =
			failedCount > 0
				? `Concluído com alertas: ${updatedCount} atualizadas, ${failedCount} com erro.`
				: `Concluído: ${updatedCount} perguntas atualizadas.`;

		finishProcess(processId, {
			status: "success",
			generationMessage: message,
		});

		if (updatedCount > 0) {
			await queryClient.invalidateQueries({
				queryKey: ["exam-detail", examId],
			});
		}
	} catch (err) {
		if (isAbortError(err) || signal.aborted) {
			finishProcess(processId, {
				status: "canceled",
				generationMessage: "Cancelado.",
			});
			return;
		}

		console.error("Failed to generate explanations:", err);
		finishProcess(processId, {
			status: "error",
			generationMessage: `Falha ao gerar explicações: ${getErrorMessage(err)}`,
		});
	} finally {
		unregisterAbort(processId);
		runNextQueued();
	}
}

export function startQueuedExplanationGeneration(processId: string): void {
	const process = getProcessById(processId);
	if (!process || !isExplanationGenerationProcess(process)) return;
	if (process.status !== "queued") return;

	void runExplanationGeneration(processId);
}

export function startExplanationGeneration(
	examId: number,
	options: StartExplanationGenerationOptions,
): string {
	const processId = explanationGenerationProcessId(examId);
	const existing = getExplanationProcessForExam(examId);
	if (
		existing &&
		(existing.status === "queued" || existing.status === "running")
	) {
		cancelExplanationGeneration(examId);
	}

	const {
		questions,
		batchSize = 8,
		overwriteExplanations = false,
	} = options;
	const questionSnapshot = questions.map((question) => ({ ...question }));
	const now = Date.now();

	const process: ExplanationGenerationBackgroundProcess = {
		kind: "explanation-generation",
		id: processId,
		examId,
		status: "queued",
		createdAt: now,
		startedAt: null,
		finishedAt: null,
		progressItems: buildProgressItems(questionSnapshot, overwriteExplanations),
		agentRuns: [],
		batchSize,
		overwriteExplanations,
		generationMessage: null,
		questions: questionSnapshot,
	};

	upsertProcess(process);
	runNextQueued();
	return processId;
}

export function cancelExplanationGeneration(examId: number): void {
	const processId = explanationGenerationProcessId(examId);
	const controller = getAbortController(processId);
	if (controller) {
		controller.abort();
		unregisterAbort(processId);
	}

	updateProcess(processId, (process) => {
		if (!isExplanationGenerationProcess(process)) return process;
		if (process.status !== "queued" && process.status !== "running") {
			return process;
		}
		return {
			...process,
			status: "canceled",
			finishedAt: Date.now(),
			generationMessage: "Cancelado.",
		};
	});
	runNextQueued();
}

export function getExplanationProcessForExam(
	examId: number,
): ExplanationGenerationBackgroundProcess | null {
	const process = getProcessById(explanationGenerationProcessId(examId));
	if (!process || !isExplanationGenerationProcess(process)) return null;
	return process;
}
