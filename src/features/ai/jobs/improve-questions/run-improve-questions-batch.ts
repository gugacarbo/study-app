import {
	buildImproveBatchPhaseEvent,
	buildImproveQuestionStageEvent,
	buildImproveQuestionStatusEvent,
} from "@/features/ai/jobs/improve-questions/improve-question-events";
import {
	IMPROVE_BATCH_PHASE,
	IMPROVE_QUESTION_STAGE,
	JOB_STATUS,
	type ImproveQuestionsJobMetadata,
} from "@/lib/job-kinds";

export type ImproveQuestionExecutionResult = {
	summary?: string | null;
};

export type ImproveQuestionExplanationsResult = {
	summary: string;
	alerts: string[];
};

export async function runImproveQuestionsBatch(input: {
	jobId: string;
	metadata: ImproveQuestionsJobMetadata;
	deps: {
		appendJobEvent: (jobId: string, payload: unknown) => Promise<void>;
		updateJobStatus: (
			jobId: string,
			patch: {
				status?: typeof JOB_STATUS[keyof typeof JOB_STATUS];
				phase?: string | null;
				error?: string | null;
				metadata?: ImproveQuestionsJobMetadata;
			},
		) => Promise<void>;
		isCancelRequested: () => Promise<boolean>;
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

	let nextIndex = 0;
	let cancelled = false;

	const markMetadata = async () => {
		await input.deps.updateJobStatus(input.jobId, {
			status: JOB_STATUS.RUNNING,
			phase: IMPROVE_BATCH_PHASE.PROCESSING_QUESTIONS,
			metadata,
		});
	};

	await input.deps.appendJobEvent(
		input.jobId,
		buildImproveBatchPhaseEvent(IMPROVE_BATCH_PHASE.PREPARING_BATCH),
	);
	await input.deps.updateJobStatus(input.jobId, {
		status: JOB_STATUS.RUNNING,
		phase: IMPROVE_BATCH_PHASE.DISPATCHING_AGENTS,
		metadata,
	});
	await input.deps.appendJobEvent(
		input.jobId,
		buildImproveBatchPhaseEvent(IMPROVE_BATCH_PHASE.DISPATCHING_AGENTS),
	);
	await input.deps.appendJobEvent(
		input.jobId,
		buildImproveBatchPhaseEvent(IMPROVE_BATCH_PHASE.PROCESSING_QUESTIONS),
	);

	const worker = async () => {
		while (nextIndex < metadata.questionIds.length && !cancelled) {
			if (await input.deps.isCancelRequested()) {
				cancelled = true;
				break;
			}

			const currentIndex = nextIndex;
			nextIndex += 1;
			const item = metadata.items[currentIndex];
			if (!item) continue;
			metadata.queuedCount = Math.max(0, metadata.queuedCount - 1);
			metadata.runningCount += 1;
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
				item.status = "failed";
				item.error = error instanceof Error ? error.message : "unknown_error";
				metadata.failedCount += 1;
				await input.deps.appendJobEvent(
					input.jobId,
					buildImproveQuestionStatusEvent({
						questionId: item.questionId,
						status: "failed",
						error: item.error,
					}),
				);
			}

			await markMetadata();
		}
	};

	const workerCount = Math.min(
		Math.max(1, metadata.concurrencyLimit),
		metadata.questionIds.length,
	);
	await Promise.all(Array.from({ length: workerCount }, () => worker()));

	if (cancelled) {
		for (const item of metadata.items) {
			if (item.status === "queued") {
				item.status = "cancelled";
				metadata.queuedCount = Math.max(0, metadata.queuedCount - 1);
				metadata.cancelledCount += 1;
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

	await input.deps.appendJobEvent(
		input.jobId,
		buildImproveBatchPhaseEvent(IMPROVE_BATCH_PHASE.FINALIZING_BATCH),
	);
	await input.deps.updateJobStatus(input.jobId, {
		status: JOB_STATUS.COMPLETED,
		error: null,
		phase: IMPROVE_BATCH_PHASE.FINALIZING_BATCH,
		metadata,
	});
}
