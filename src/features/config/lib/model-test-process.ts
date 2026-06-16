import type { BackgroundProcess } from "@/features/background-processes";
import {
	connectionTestProcessId,
	isConnectionTestProcess,
	isModelBenchmarkProcess,
	modelBenchmarkProcessId,
} from "@/features/background-processes";

export type ModelTestMode = "quick" | "benchmark";

export type ModelTestProcessSelection = {
	process: BackgroundProcess;
	mode: ModelTestMode;
};

function isActiveTestStatus(status: BackgroundProcess["status"]): boolean {
	return status === "queued" || status === "running";
}

function isFinishedTestStatus(status: BackgroundProcess["status"]): boolean {
	return status === "success" || status === "error" || status === "canceled";
}

function processFinishedAt(process: BackgroundProcess): number {
	if (isConnectionTestProcess(process) || isModelBenchmarkProcess(process)) {
		return process.finishedAt ?? process.createdAt;
	}
	return 0;
}

export function getModelTestProcessForModel(
	modelId: number,
	processes: BackgroundProcess[],
): ModelTestProcessSelection | null {
	const connection = processes.find(
		(candidate) => candidate.id === connectionTestProcessId(modelId),
	);
	const benchmark = processes.find(
		(candidate) => candidate.id === modelBenchmarkProcessId(modelId),
	);

	const candidates = [connection, benchmark].filter(
		(candidate): candidate is BackgroundProcess => candidate != null,
	);

	const running = candidates.find((candidate) =>
		isActiveTestStatus(candidate.status),
	);
	if (running) {
		return {
			process: running,
			mode: isModelBenchmarkProcess(running) ? "benchmark" : "quick",
		};
	}

	const finished = candidates
		.filter((candidate) => isFinishedTestStatus(candidate.status))
		.sort((left, right) => processFinishedAt(right) - processFinishedAt(left));

	const latest = finished[0];
	if (!latest) return null;

	return {
		process: latest,
		mode: isModelBenchmarkProcess(latest) ? "benchmark" : "quick",
	};
}
