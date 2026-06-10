import { focusJob } from "../kinds/ingest/actions";
import { cancelProcess as cancelProcessRegistry } from "./registry";
import {
	backgroundProcessStore,
	focusProcess as focusProcessInStore,
	getProcessById,
} from "./store";
import { isIngestProcess, parseIngestProcessId } from "./types";

export function focusProcess(id: string): void {
	const process = getProcessById(id);
	if (!process) return;

	focusProcessInStore(id);

	if (isIngestProcess(process)) {
		const jobId = parseIngestProcessId(process.id) ?? process.id;
		focusJob(jobId);
	}
}

export function cancelProcess(id: string): void {
	cancelProcessRegistry(id);
}

export function getFocusedProcess() {
	const { focusedProcessId } = backgroundProcessStore.state;
	if (!focusedProcessId) return null;
	return getProcessById(focusedProcessId);
}
