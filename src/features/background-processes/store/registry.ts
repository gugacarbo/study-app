import { cancelExplanationGeneration } from "../kinds/explanation-generation/actions";
import { cancelJob } from "../kinds/ingest/actions";
import { cancelImproveQuestionsRun } from "../kinds/improve-questions/actions";
import { getProcessById } from "./store";
import {
	isExplanationGenerationProcess,
	isImproveQuestionsProcess,
	isIngestProcess,
	parseIngestProcessId,
} from "./types";

const abortControllers = new Map<string, AbortController>();

export function registerAbort(id: string, controller: AbortController): void {
	const existing = abortControllers.get(id);
	if (existing) {
		existing.abort();
	}
	abortControllers.set(id, controller);
}

export function unregisterAbort(id: string): void {
	abortControllers.delete(id);
}

export function getAbortController(id: string): AbortController | undefined {
	return abortControllers.get(id);
}

export function cancelProcess(id: string): void {
	const controller = abortControllers.get(id);
	if (controller) {
		controller.abort();
		unregisterAbort(id);
	}

	const process = getProcessById(id);
	if (!process) return;

	if (isIngestProcess(process)) {
		const jobId = parseIngestProcessId(process.id) ?? process.id;
		cancelJob(jobId);
		return;
	}

	if (isImproveQuestionsProcess(process)) {
		cancelImproveQuestionsRun(process.questionId);
		return;
	}

	if (isExplanationGenerationProcess(process)) {
		cancelExplanationGeneration(process.examId);
	}
}
