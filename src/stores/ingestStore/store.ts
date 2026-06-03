import { Store } from "@tanstack/store";
import { loadInitialState, persistIngestState } from "./persistence";
import type { IngestStoreState } from "./types";

export const ingestStore = new Store<IngestStoreState>(loadInitialState());

let persistTimer: ReturnType<typeof setTimeout> | null = null;
ingestStore.subscribe(() => {
	if (persistTimer) clearTimeout(persistTimer);
	persistTimer = setTimeout(() => {
		persistIngestState(ingestStore.state);
	}, 0);
});
