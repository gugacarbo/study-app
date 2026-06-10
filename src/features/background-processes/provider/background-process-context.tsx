import { createContext } from "react";
import type { BackgroundProcess } from "../store/types";

export interface BackgroundProcessContextValue {
	processes: BackgroundProcess[];
	activeProcesses: BackgroundProcess[];
	recentProcesses: BackgroundProcess[];
	activeCount: number;
	focusedProcessId: string | null;
	focusProcess: (id: string) => void;
	cancelProcess: (id: string) => void;
}

export const BackgroundProcessContext =
	createContext<BackgroundProcessContextValue | null>(null);
