import type {
	IngestAgentRunViewModel,
	IngestPipelineStageViewModel,
} from "../types";

export function agentStateLabel(state: IngestAgentRunViewModel["state"]): {
	text: string;
	className: string;
} {
	switch (state) {
		case "running":
			return {
				text: "Running",
				className:
					"bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
			};
		case "success":
			return {
				text: "Done",
				className:
					"bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
			};
		case "warning":
			return {
				text: "Warning",
				className:
					"bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
			};
		case "error":
			return {
				text: "Error",
				className:
					"bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
			};
		default:
			return {
				text: "Pending",
				className:
					"bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
			};
	}
}

export function stageStatusLabel(
	status: IngestPipelineStageViewModel["status"],
): { text: string; className: string } {
	switch (status) {
		case "running":
			return {
				text: "Running",
				className:
					"bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
			};
		case "done":
			return {
				text: "Done",
				className:
					"bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
			};
		case "warning":
			return {
				text: "Warning",
				className:
					"bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
			};
		case "error":
			return {
				text: "Error",
				className:
					"bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
			};
		case "skipped":
			return {
				text: "Skipped",
				className:
					"bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
			};
		default:
			return {
				text: "Pending",
				className:
					"bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
			};
	}
}
