import { startQueuedConnectionTest } from "../kinds/connection-test/actions";
import { startQueuedModelBenchmark } from "../kinds/model-benchmark/actions";
import { startQueuedExplainQuestion } from "../kinds/explain-question/actions";
import { startQueuedIngest } from "../kinds/ingest/actions";
import { startQueuedImproveQuestions } from "../kinds/improve-questions/actions";
import { backgroundProcessStore } from "./store";
import type { BackgroundProcess } from "./types";
import {
	isConnectionTestProcess,
	isExplainQuestionProcess,
	isImproveQuestionsProcess,
	isIngestProcess,
	isModelBenchmarkProcess,
} from "./types";

function getImproveQuestionsMaxWorkers(examId: number): number | null {
	return (
		backgroundProcessStore.state.improveQuestionsBatchByExam[examId]
			?.maxWorkers ?? null
	);
}

function getExplainQuestionsMaxWorkers(examId: number): number | null {
	return (
		backgroundProcessStore.state.explainQuestionsBatchByExam[examId]
			?.maxWorkers ?? null
	);
}

function countRunningImproveQuestionsForExam(
	examId: number,
	runningProcesses: BackgroundProcess[],
): number {
	return runningProcesses.filter(
		(candidate) =>
			isImproveQuestionsProcess(candidate) && candidate.examId === examId,
	).length;
}

function countRunningExplainQuestionsForExam(
	examId: number,
	runningProcesses: BackgroundProcess[],
): number {
	return runningProcesses.filter(
		(candidate) =>
			isExplainQuestionProcess(candidate) && candidate.examId === examId,
	).length;
}

export function canStart(
	process: BackgroundProcess,
	runningProcesses: BackgroundProcess[],
): boolean {
	if (process.status !== "queued") return false;

	if (isIngestProcess(process)) {
		return !runningProcesses.some(
			(candidate) =>
				isIngestProcess(candidate) && candidate.status === "running",
		);
	}

	if (isImproveQuestionsProcess(process)) {
		const sameQuestionRunning = runningProcesses.some(
			(candidate) =>
				isImproveQuestionsProcess(candidate) &&
				candidate.status === "running" &&
				candidate.questionId === process.questionId,
		);
		if (sameQuestionRunning) return false;

		const maxWorkers = getImproveQuestionsMaxWorkers(process.examId);
		if (maxWorkers !== null) {
			const runningForExam = countRunningImproveQuestionsForExam(
				process.examId,
				runningProcesses,
			);
			if (runningForExam >= maxWorkers) return false;
		}

		return true;
	}

	if (isExplainQuestionProcess(process)) {
		const sameQuestionRunning = runningProcesses.some(
			(candidate) =>
				isExplainQuestionProcess(candidate) &&
				candidate.status === "running" &&
				candidate.questionId === process.questionId,
		);
		if (sameQuestionRunning) return false;

		const maxWorkers = getExplainQuestionsMaxWorkers(process.examId);
		if (maxWorkers !== null) {
			const runningForExam = countRunningExplainQuestionsForExam(
				process.examId,
				runningProcesses,
			);
			if (runningForExam >= maxWorkers) return false;
		}

		return true;
	}

	if (isConnectionTestProcess(process)) {
		return !runningProcesses.some(
			(candidate) =>
				isConnectionTestProcess(candidate) &&
				candidate.status === "running" &&
				candidate.modelId === process.modelId,
		);
	}

	if (isModelBenchmarkProcess(process)) {
		return !runningProcesses.some(
			(candidate) =>
				isModelBenchmarkProcess(candidate) &&
				candidate.status === "running" &&
				candidate.modelId === process.modelId,
		);
	}

	return false;
}

export function runNextQueued(): void {
	const { processes } = backgroundProcessStore.state;
	const running = processes.filter((process) => process.status === "running");
	const queued = processes.filter((process) => process.status === "queued");

	const queuedIngest = queued
		.filter(isIngestProcess)
		.sort((left, right) => left.createdAt - right.createdAt);

	for (const process of queuedIngest) {
		if (canStart(process, running)) {
			startQueuedIngest(process.id);
			return;
		}
	}

	for (const process of queued.filter(isImproveQuestionsProcess)) {
		if (canStart(process, running)) {
			startQueuedImproveQuestions(process.id);
			running.push({ ...process, status: "running" });
		}
	}

	for (const process of queued.filter(isExplainQuestionProcess)) {
		if (canStart(process, running)) {
			startQueuedExplainQuestion(process.id);
			running.push({ ...process, status: "running" });
		}
	}

	for (const process of queued.filter(isConnectionTestProcess)) {
		if (canStart(process, running)) {
			startQueuedConnectionTest(process.id);
			running.push({ ...process, status: "running" });
		}
	}

	for (const process of queued.filter(isModelBenchmarkProcess)) {
		if (canStart(process, running)) {
			startQueuedModelBenchmark(process.id);
			running.push({ ...process, status: "running" });
		}
	}
}
