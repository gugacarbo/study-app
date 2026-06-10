import { Store } from "@tanstack/store";
import { loadInitialState, persistBackgroundProcessState } from "./persistence";
import type {
	BackgroundProcess,
	BackgroundProcessKind,
	BackgroundProcessStoreState,
	ExplanationGenerationBackgroundProcess,
	ImproveQuestionsBackgroundProcess,
	IngestBackgroundProcess,
} from "./types";
import { isExplanationGenerationProcess, isImproveQuestionsProcess, isIngestProcess } from "./types";

export const backgroundProcessStore = new Store<BackgroundProcessStoreState>(
	loadInitialState(),
);

let persistTimer: ReturnType<typeof setTimeout> | null = null;
backgroundProcessStore.subscribe(() => {
	if (persistTimer) clearTimeout(persistTimer);
	persistTimer = setTimeout(() => {
		persistBackgroundProcessState(backgroundProcessStore.state);
	}, 0);
});

export function updateProcess(
	id: string,
	updater: (process: BackgroundProcess) => BackgroundProcess,
): void {
	backgroundProcessStore.setState((state) => ({
		...state,
		processes: state.processes.map((process) =>
			process.id === id ? updater(process) : process,
		),
	}));
}

export function upsertProcess(process: BackgroundProcess): void {
	backgroundProcessStore.setState((state) => {
		const index = state.processes.findIndex(
			(candidate) => candidate.id === process.id,
		);
		if (index === -1) {
			return { ...state, processes: [...state.processes, process] };
		}
		const processes = [...state.processes];
		processes[index] = process;
		return { ...state, processes };
	});
}

export function removeProcess(id: string): void {
	backgroundProcessStore.setState((state) => ({
		...state,
		processes: state.processes.filter((process) => process.id !== id),
		focusedProcessId:
			state.focusedProcessId === id ? null : state.focusedProcessId,
	}));
}

export function getProcessesByKind<K extends BackgroundProcessKind>(
	kind: K,
): Extract<BackgroundProcess, { kind: K }>[] {
	return backgroundProcessStore.state.processes.filter(
		(process): process is Extract<BackgroundProcess, { kind: K }> =>
			process.kind === kind,
	);
}

export function getProcessById(id: string): BackgroundProcess | null {
	return (
		backgroundProcessStore.state.processes.find(
			(process) => process.id === id,
		) ?? null
	);
}

export function focusProcess(id: string): void {
	backgroundProcessStore.setState((state) => ({
		...state,
		focusedProcessId: id,
	}));
}

export function getIngestProcesses(): IngestBackgroundProcess[] {
	return backgroundProcessStore.state.processes.filter(isIngestProcess);
}

export function getImproveQuestionsProcesses(): ImproveQuestionsBackgroundProcess[] {
	return backgroundProcessStore.state.processes.filter(isImproveQuestionsProcess);
}

export function getExplanationProcesses(): ExplanationGenerationBackgroundProcess[] {
	return backgroundProcessStore.state.processes.filter(
		isExplanationGenerationProcess,
	);
}
