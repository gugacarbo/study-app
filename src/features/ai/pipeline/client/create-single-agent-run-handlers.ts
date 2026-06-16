import type {
	ExplanationUpdateDataPart,
	JobResultDataPart,
	WorkspaceUpdateDataPart,
} from "@/features/ai/types/ui-message-data-parts";
import {
	applyAgentRunPart,
	createSingleAgentRunState,
	type AgentRunState,
} from "./single-agent-run-reducer";
import type { RunJobPipelineHandlers } from "./run-job-pipeline";

export interface CreateSingleAgentRunHandlersOptions {
	initialState?: AgentRunState;
	onStateChange?: (state: AgentRunState) => void;
	onWorkspaceUpdate?: (data: WorkspaceUpdateDataPart) => void;
	onExplanationUpdate?: (data: ExplanationUpdateDataPart) => void;
	onResult?: (data: JobResultDataPart) => void;
}

export function createSingleAgentRunHandlers(
	options: CreateSingleAgentRunHandlersOptions,
): RunJobPipelineHandlers & {
	getState: () => AgentRunState;
	resetState: (state: AgentRunState) => void;
} {
	let runState =
		options.initialState ??
		createSingleAgentRunState({
			agentRunId: "pending",
			label: "Agent",
		});

	const publish = () => {
		options.onStateChange?.(runState);
	};

	return {
		getState: () => runState,
		resetState: (state: AgentRunState) => {
			runState = state;
			publish();
		},
		onAgentRun(_ctx, data) {
			runState = applyAgentRunPart(runState, data);
			publish();
		},
		onDomainPart(_ctx, part) {
			if (part.type === "data-workspace-update") {
				options.onWorkspaceUpdate?.(part.data);
				return;
			}
			if (part.type === "data-explanation-update") {
				options.onExplanationUpdate?.(part.data);
			}
		},
		onResult(_ctx, data) {
			options.onResult?.(data);
		},
	};
}
