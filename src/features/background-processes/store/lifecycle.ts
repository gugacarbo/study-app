import { backgroundProcessStore } from "./store";
import { getActiveProcesses } from "./types";

let lifecycleInitialized = false;

function handleBeforeUnload(event: BeforeUnloadEvent): void {
	const activeProcesses = getActiveProcesses(
		backgroundProcessStore.state.processes,
	);
	if (activeProcesses.length > 0) {
		event.preventDefault();
	}
}

export function initLifecycle(): void {
	if (typeof window === "undefined" || lifecycleInitialized) return;

	window.addEventListener("beforeunload", handleBeforeUnload);
	lifecycleInitialized = true;
}

export function destroyLifecycle(): void {
	if (typeof window === "undefined" || !lifecycleInitialized) return;

	window.removeEventListener("beforeunload", handleBeforeUnload);
	lifecycleInitialized = false;
}
