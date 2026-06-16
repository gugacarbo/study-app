import { cancelConnectionTest } from "../kinds/connection-test/actions";
import { cancelExplainQuestionRun } from "../kinds/explain-question/actions";
import { cancelImproveQuestionsRun } from "../kinds/improve-questions/actions";
import { cancelJob } from "../kinds/ingest/actions";
import { cancelModelBenchmark } from "../kinds/model-benchmark/actions";
import { getProcessById } from "./store";
import {
	isConnectionTestProcess,
	isExplainQuestionProcess,
	isImproveQuestionsProcess,
	isIngestProcess,
	isModelBenchmarkProcess,
	parseConnectionTestProcessId,
	parseIngestProcessId,
	parseModelBenchmarkProcessId,
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

	if (isExplainQuestionProcess(process)) {
		cancelExplainQuestionRun(process.questionId);
		return;
	}

	if (isConnectionTestProcess(process)) {
		const modelId = parseConnectionTestProcessId(process.id) ?? process.modelId;
		cancelConnectionTest(modelId);
		return;
	}

	if (isModelBenchmarkProcess(process)) {
		const modelId = parseModelBenchmarkProcessId(process.id) ?? process.modelId;
		cancelModelBenchmark(modelId);
	}
}
