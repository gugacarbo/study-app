import type { StudyAppDataUIPart } from "@/features/ai/lib/read-job-ui-message-stream";
import type {
	AgentRunDataPart,
	JobProgressDataPart,
	ProcessLogDataPart,
	StageDataPart,
} from "@/features/ai/types/ui-message-data-parts";
import type { PipelineLogEntry, PipelineLogLevel } from "../types";

let entryCounter = 0;

function generateLogId(): string {
	entryCounter += 1;
	return `log_${Date.now()}_${entryCounter}`;
}

export interface PipelineLogReducerState {
	logs: PipelineLogEntry[];
	stepText: string;
}

const DEDUPE_WINDOW_MS = 100;

function stageStatusToLevel(
	status: StageDataPart["status"],
): PipelineLogLevel {
	switch (status) {
		case "warning":
			return "warning";
		case "error":
			return "error";
		default:
			return "info";
	}
}

function processLogPartToEntry(data: ProcessLogDataPart): PipelineLogEntry {
	return {
		id: generateLogId(),
		timestamp: data.timestamp ?? Date.now(),
		level: data.level,
		message: data.message,
		stageId: data.stageId ?? null,
		agentRunId: data.agentRunId ?? null,
		data: data.data,
	};
}

export function createPipelineLogReducer() {
	const state: PipelineLogReducerState = {
		logs: [],
		stepText: "",
	};
	const recentKeys = new Map<string, number>();

	const append = (
		entry: Omit<PipelineLogEntry, "id"> & { id?: string },
	): PipelineLogEntry | null => {
		const timestamp = entry.timestamp;
		const dedupeKey = `${timestamp}:${entry.message}`;
		const now = Date.now();
		const lastSeen = recentKeys.get(dedupeKey);
		if (lastSeen != null && now - lastSeen < DEDUPE_WINDOW_MS) {
			return null;
		}
		recentKeys.set(dedupeKey, now);

		const logEntry: PipelineLogEntry = {
			id: entry.id ?? generateLogId(),
			timestamp,
			level: entry.level,
			message: entry.message,
			stageId: entry.stageId ?? null,
			agentRunId: entry.agentRunId ?? null,
			data: entry.data,
		};
		state.logs.push(logEntry);
		return logEntry;
	};

	const setStepText = (stepText: string) => {
		state.stepText = stepText;
	};

	const handleDataPart = (part: StudyAppDataUIPart): PipelineLogEntry | null => {
		if (part.type === "data-process-log") {
			return append(processLogPartToEntry(part.data));
		}

		if (part.type === "data-job-progress") {
			const data = part.data as JobProgressDataPart;
			if (data.step) {
				setStepText(data.step);
				return append({
					timestamp: Date.now(),
					level: "info",
					message: data.step,
					stageId: data.stageId ?? null,
					agentRunId: data.agentRunId ?? null,
				});
			}
			return null;
		}

		if (part.type === "data-stage") {
			const data = part.data as StageDataPart;
			return append({
				timestamp: data.timestamp ?? Date.now(),
				level: stageStatusToLevel(data.status),
				message: `${data.label}: ${data.status}`,
				stageId: data.stageId,
			});
		}

		if (part.type === "data-agent-run") {
			const data = part.data as AgentRunDataPart;
			if (data.eventType === "warning" && data.warning) {
				return append({
					timestamp: data.timestamp ?? Date.now(),
					level: "warning",
					message: data.warning,
					stageId: data.stageId,
					agentRunId: data.agentRunId,
				});
			}
			if (data.eventType === "lifecycle" && data.status === "error" && data.error) {
				return append({
					timestamp: data.timestamp ?? Date.now(),
					level: "error",
					message: data.error,
					stageId: data.stageId,
					agentRunId: data.agentRunId,
				});
			}
		}

		if (part.type === "data-job-error") {
			return append({
				timestamp: Date.now(),
				level: "error",
				message: part.data.message,
				stageId: part.data.stageId ?? null,
				agentRunId: part.data.agentRunId ?? null,
			});
		}

		return null;
	};

	return {
		getState: () => state,
		append,
		setStepText,
		handleDataPart,
	};
}

export function appendPipelineLog<T extends { logs: PipelineLogEntry[] }>(
	process: T,
	entry: PipelineLogEntry,
): Pick<T, "logs"> {
	return {
		logs: [...process.logs, entry],
	};
}

export function setPipelineStep<T extends { stepText: string }>(
	_process: T,
	stepText: string,
): Pick<T, "stepText"> {
	return { stepText };
}
