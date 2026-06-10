import { Store } from "@tanstack/store";
import type { ImproveOptionsStoreState } from "./types";

export const improveOptionsStore = new Store<ImproveOptionsStoreState>({
	runs: {},
});
