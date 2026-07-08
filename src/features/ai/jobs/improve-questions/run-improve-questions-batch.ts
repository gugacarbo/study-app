import {
	buildImproveBatchPhaseEvent,
	buildImproveQuestionStageEvent,
	buildImproveQuestionStatusEvent,
} from "@/features/ai/jobs/improve-questions/improve-question-events";
import {
	IMPROVE_BATCH_PHASE,
	IMPROVE_QUESTION_STAGE,
	JOB_STATUS,
	type ImproveQuestionItem,
	type ImproveQuestionsJobMetadata,
} from "@/lib/job-kinds";

export type ImproveQuestionExecutionResult = {
	summary?: string | null;
};

export type ImproveQuestionExplanationsResult = {
	summary: string;
	alerts: string[];
};

export type QuestionCancelChecker = (questionId: string) => Promise<boolean>;

export async function runImproveQuestionsBatch(input: {
	jobId: string;
	metadata: ImproveQuestionsJobMetadata;
	deps: {
		appendJobEvent: (jobId: string, payload: unknown) => Promise<void>;
		updateJobStatus: (
			jobId: string,
			patch: {
				status?: (typeof JOB_STATUS)[keyof typeof JOB_STATUS];
				phase?: string | null;
				error?: string | null;
				metadata?: ImproveQuestionsJobMetadata;
			},
		) => Promise<void>;
		isCancelRequested: () => Promise<boolean>;
		isQuestionCancelled?: QuestionCancelChecker;
		executeQuestion: (input: {
			jobId: string;
			questionId: string;
			writeOptionExplanations?: boolean;
		}) => Promise<ImproveQuestionExecutionResult>;
		executeExplanations?: (input: {
			jobId: string;
			questionId: string;
		}) => Promise<ImproveQuestionExplanationsResult>;
	};
}): Promise<void> {
	const metadata: ImproveQuestionsJobMetadata = {
		...input.metadata,
		items: input.metadata.items.map((item) => ({ ...item })),
	};

	let cancelled = false;

	const markMetadata = async () => {
		await input.deps.updateJobStatus(input.jobId, {
			status: JOB_STATUS.RUNNING,
			phase: IMPROVE_BATCH_PHASE.PROCESSING_QUESTIONS,
			metadata,
		});
	};

	const emitBatchPhase = async (
		phase: (typeof IMPROVE_BATCH_PHASE)[keyof typeof IMPROVE_BATCH_PHASE],
	) => {
		await input.deps.appendJobEvent(input.jobId, buildImproveBatchPhaseEvent(phase));
	};

	await emitBatchPhase(IMPROVE_BATCH_PHASE.PREPARING_BATCH);
	await input.deps.updateJobStatus(input.jobId, {
		status: JOB_STATUS.RUNNING,
		phase: IMPROVE_BATCH_PHASE.DISPATCHING_AGENTS,
		metadata,
	});
	await emitBatchPhase(IMPROVE_BATCH_PHASE.DISPATCHING_AGENTS);
	await emitBatchPhase(IMPROVE_BATCH_PHASE.PROCESSING_QUESTIONS);

	const findNextRunnableQuestion = (): ImproveQuestionItem | null => {
		for (const item of metadata.items) {
			if (item.status === "queued") {
				return item;
			}
		}
		return null;
	};

	const isJobCancelled = async (): Promise<boolean> => {
		if (cancelled) return true;
		if (await input.deps.isCancelRequested()) {
			cancelled = true;
			return true;
		}
		return false;
	};

	const isQuestionCancelled = async (questionId: string): Promise<boolean> => {
		const item = metadata.items.find((i) => i.questionId === questionId);
		if (!item) return false;
		if (item.cancelRequestedAt != null || item.status === "cancelled") return true;
		const signal = await input.deps.isQuestionCancelled?.(questionId);
		return signal ?? false;
	};

	const runQuestion = async (item: ImproveQuestionItem): Promise<void> => {
		metadata.runningCount += 1;
		metadata.queuedCount = Math.max(0, metadata.queuedCount - 1);
		item.status = "running";
		item.stage = IMPROVE_QUESTION_STAGE.LOADING_QUESTION;
		await input.deps.appendJobEvent(
			input.jobId,
			buildImproveQuestionStageEvent(
				item.questionId,
				IMPROVE_QUESTION_STAGE.LOADING_QUESTION,
			),
		);
		await markMetadata();

		try {
			if (await isQuestionCancelled(item.questionId)) {
				throw new QuestionCancelledError(item.questionId);
			}

			const result = await input.deps.executeQuestion({
				jobId: input.jobId,
				questionId: item.questionId,
				writeOptionExplanations: metadata.writeOptionExplanations,
			});
			let finalSummary = result.summary ?? null;
			if (metadata.writeExplanations) {
				item.stage = IMPROVE_QUESTION_STAGE.WRITING_EXPLANATIONS;
				await input.deps.appendJobEvent(
					input.jobId,
					buildImproveQuestionStageEvent(
						item.questionId,
						IMPROVE_QUESTION_STAGE.WRITING_EXPLANATIONS,
					),
				);
				await markMetadata();
				const explanationResult = await input.deps.executeExplanations?.({
					jobId: input.jobId,
					questionId: item.questionId,
				});
				finalSummary = explanationResult?.summary ?? finalSummary;
			}
			metadata.runningCount = Math.max(0, metadata.runningCount - 1);
			item.status = "completed";
			item.stage = IMPROVE_QUESTION_STAGE.SAVING_DRAFT;
			item.summary = finalSummary ?? undefined;
			item.error = undefined;
			item.cancelRequestedAt = undefined;
			metadata.completedCount += 1;
			metadata.pendingReviewCount += 1;
			await input.deps.appendJobEvent(
				input.jobId,
				buildImproveQuestionStatusEvent({
					questionId: item.questionId,
					status: "completed",
					summary: finalSummary,
				}),
			);
		} catch (error) {
			metadata.runningCount = Math.max(0, metadata.runningCount - 1);
			if (error instanceof QuestionCancelledError) {
				item.status = "cancelled";
				item.stage = item.stage ?? IMPROVE_QUESTION_STAGE.QUEUED;
				metadata.cancelledCount += 1;
				item.error = undefined;
				item.summary = undefined;
			} else {
				item.status = "failed";
				item.stage = IMPROVE_QUESTION_STAGE.QUEUED;
				item.error = error instanceof Error ? error.message : "unknown_error";
				metadata.failedCount += 1;
			}
			await input.deps.appendJobEvent(
				input.jobId,
				buildImproveQuestionStatusEvent({
					questionId: item.questionId,
					status: item.status,
					error: item.error,
				}),
			);
		}

		await markMetadata();
	};

	const worker = async () => {
		while (!cancelled) {
			if (await isJobCancelled()) break;

			const item = findNextRunnableQuestion();
			if (!item) break;

			await runQuestion(item);
		}
	};

	const workerCount = Math.min(
		Math.max(1, metadata.concurrencyLimit),
		metadata.items.length,
	);
	await Promise.all(Array.from({ length: workerCount }, () => worker()));

	if (cancelled) {
		for (const item of metadata.items) {
			if (item.status === "queued" || item.status === "running") {
				if (item.status === "queued") {
					metadata.queuedCount = Math.max(0, metadata.queuedCount - 1);
					metadata.cancelledCount += 1;
				} else {
					metadata.runningCount = Math.max(0, metadata.runningCount - 1);
					metadata.cancelledCount += 1;
				}
				item.status = "cancelled";
				item.stage = item.stage ?? IMPROVE_QUESTION_STAGE.QUEUED;
				item.error = undefined;
				item.summary = undefined;
				await input.deps.appendJobEvent(
					input.jobId,
					buildImproveQuestionStatusEvent({
						questionId: item.questionId,
						status: "cancelled",
					}),
				);
			}
		}
		await input.deps.updateJobStatus(input.jobId, {
			status: JOB_STATUS.CANCELLED,
			error: null,
			phase: IMPROVE_BATCH_PHASE.FINALIZING_BATCH,
			metadata,
		});
		return;
	}

	await emitBatchPhase(IMPROVE_BATCH_PHASE.FINALIZING_BATCH);
	const hasPendingItems = metadata.items.some(
		(item) => item.status === "failed" || item.status === "cancelled",
	);
	await input.deps.updateJobStatus(input.jobId, {
		status: hasPendingItems ? JOB_STATUS.FAILED : JOB_STATUS.COMPLETED,
		error: hasPendingItems ? "some_questions_failed_or_were_cancelled" : null,
		phase: IMPROVE_BATCH_PHASE.FINALIZING_BATCH,
		metadata,
	});
}

class QuestionCancelledError extends Error {
	constructor(questionId: string) {
		super(`Question ${questionId} was cancelled`);
		this.name = "QuestionCancelledError";
	}
}
