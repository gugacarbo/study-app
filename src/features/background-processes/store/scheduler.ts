import { startQueuedExplanationGeneration } from "../kinds/explanation-generation/actions";
import { startQueuedIngest } from "../kinds/ingest/actions";
import { startQueuedImproveQuestions } from "../kinds/improve-questions/actions";
import { backgroundProcessStore } from "./store";
import type { BackgroundProcess } from "./types";
import {
	isExplanationGenerationProcess,
	isImproveQuestionsProcess,
	isIngestProcess,
} from "./types";

function getImproveQuestionsMaxWorkers(examId: number): number | null {
	return (
		backgroundProcessStore.state.improveQuestionsBatchByExam[examId]
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

	if (isExplanationGenerationProcess(process)) {
		return !runningProcesses.some(
			(candidate) =>
				isExplanationGenerationProcess(candidate) &&
				candidate.status === "running" &&
				candidate.examId === process.examId,
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

	for (const process of queued.filter(isExplanationGenerationProcess)) {
		if (canStart(process, running)) {
			startQueuedExplanationGeneration(process.id);
		}
	}
}
