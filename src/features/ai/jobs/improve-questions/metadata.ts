import {
	IMPROVE_QUESTION_STAGE,
	type ImproveQuestionItem,
	type ImproveQuestionItemStatus,
	type ImproveQuestionsJobMetadata,
} from "@/lib/job-kinds";

export type ImproveQuestionActionResult = {
	ok: true;
	item: ImproveQuestionItem;
	metadata: ImproveQuestionsJobMetadata;
};

function cloneMetadata(
	metadata: ImproveQuestionsJobMetadata,
): ImproveQuestionsJobMetadata {
	return {
		...metadata,
		items: metadata.items.map((item) => ({ ...item })),
	};
}

function adjustCountsForRetry(
	metadata: ImproveQuestionsJobMetadata,
	item: ImproveQuestionItem,
) {
	const previousStatus = item.status;
	if (previousStatus === "failed") {
		metadata.failedCount = Math.max(0, metadata.failedCount - 1);
	} else if (previousStatus === "cancelled") {
		metadata.cancelledCount = Math.max(0, metadata.cancelledCount - 1);
	}
}

export function cancelImproveQuestionItem(
	metadata: ImproveQuestionsJobMetadata,
	questionId: string,
): ImproveQuestionActionResult | { ok: false; reason: string } {
	const cloned = cloneMetadata(metadata);
	const item = cloned.items.find((i) => i.questionId === questionId);
	if (!item) {
		return { ok: false, reason: "question_not_found" };
	}

	const terminalStatuses: ImproveQuestionItemStatus[] = [
		"completed",
		"failed",
		"cancelled",
	];
	if (terminalStatuses.includes(item.status)) {
		return { ok: false, reason: "already_terminal" };
	}

	if (item.status === "running") {
		item.cancelRequestedAt = new Date().toISOString();
	} else {
		if (item.status === "queued") {
			cloned.queuedCount = Math.max(0, cloned.queuedCount - 1);
			cloned.cancelledCount += 1;
		}
		item.status = "cancelled";
		item.stage = item.stage ?? IMPROVE_QUESTION_STAGE.QUEUED;
	}

	return { ok: true, item, metadata: cloned };
}

export function retryImproveQuestionItem(
	metadata: ImproveQuestionsJobMetadata,
	questionId: string,
): ImproveQuestionActionResult | { ok: false; reason: string } {
	const cloned = cloneMetadata(metadata);
	const item = cloned.items.find((i) => i.questionId === questionId);
	if (!item) {
		return { ok: false, reason: "question_not_found" };
	}

	const retryableStatuses: ImproveQuestionItemStatus[] = [
		"failed",
		"cancelled",
	];
	if (!retryableStatuses.includes(item.status)) {
		return { ok: false, reason: "not_retryable" };
	}

	adjustCountsForRetry(cloned, item);
	item.status = "queued";
	item.stage = IMPROVE_QUESTION_STAGE.QUEUED;
	item.error = undefined;
	item.summary = undefined;
	item.cancelRequestedAt = undefined;
	item.retryAttempt = (item.retryAttempt ?? 0) + 1;
	cloned.queuedCount += 1;

	return { ok: true, item, metadata: cloned };
}

export function isImproveQuestionCancelled(
	item: ImproveQuestionItem,
): boolean {
	return item.cancelRequestedAt != null || item.status === "cancelled";
}
