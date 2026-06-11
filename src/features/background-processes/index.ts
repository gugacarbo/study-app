export { useBackgroundProcesses } from "./hooks/use-background-processes";
export { BackgroundProcessProvider } from "./provider/background-process-provider";
export type { BackgroundProcessContextValue } from "./provider/background-process-context";

export { cancelProcess, focusProcess, getFocusedProcess } from "./store/actions";
export { destroyLifecycle, initLifecycle } from "./store/lifecycle";
export {
	cancelProcess as cancelProcessAbort,
	getAbortController,
	registerAbort,
	unregisterAbort,
} from "./store/registry";
export {
	clearCompletedIngestProcessesFromState,
	hydrateBackgroundProcessStateFromStorage,
	serializeBackgroundProcessStateForStorage,
	trimCompletedIngestProcesses,
} from "./store/persistence";
export { canStart, runNextQueued } from "./store/scheduler";
export {
	areImproveQuestionsExamViewsEqual,
	selectImproveQuestionsExamViews,
	type ImproveQuestionsExamProcessView,
} from "./store/improve-questions-selectors";
export {
	backgroundProcessStore,
	focusProcess as focusProcessInStore,
	getExplanationProcesses,
	getImproveQuestionsProcesses,
	getIngestProcesses,
	getProcessById,
	getProcessesByKind,
	removeProcess,
	updateProcess,
	upsertProcess,
} from "./store/store";
export type {
	BackgroundProcess,
	BackgroundProcessKind,
	BackgroundProcessStatus,
	BackgroundProcessStoreState,
	ExplanationGenerationBackgroundProcess,
	ExplanationQuestionSnapshot,
	ImproveQuestionsBackgroundProcess,
	ImproveQuestionsRunPhase,
	IngestBackgroundProcess,
	IngestProcessStatus,
	PersistedBackgroundProcessState,
	PersistedIngestProcess,
} from "./store/types";
export {
	BACKGROUND_PROCESS_STORAGE_KEY,
	explanationGenerationProcessId,
	getActiveProcesses,
	getRecentProcesses,
	ingestProcessId,
	ingestJobToProcess,
	ingestProcessToJob,
	isActiveProcess,
	isCompletedProcess,
	isExplanationGenerationProcess,
	isImproveQuestionsProcess,
	isIngestProcess,
	improveQuestionsProcessId,
	MAX_RECENT_COMPLETED_PROCESSES,
	parseExplanationGenerationProcessId,
	parseImproveQuestionsProcessId,
	parseIngestProcessId,
} from "./store/types";

export * from "./kinds/ingest";
export * from "./kinds/improve-questions";
export * from "./kinds/explanation-generation";
