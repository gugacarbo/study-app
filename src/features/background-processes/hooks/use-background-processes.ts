import { useContext } from "react";
import { BackgroundProcessContext } from "../provider/background-process-context";

export function useBackgroundProcesses() {
	const context = useContext(BackgroundProcessContext);
	if (!context) {
		throw new Error(
			"useBackgroundProcesses must be used within a BackgroundProcessProvider",
		);
	}
	return context;
}
