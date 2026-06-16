import { bridgeAgentRunEvent } from "@/features/ai/core/bridge-agent-run-event";
import type {
	AgentRunDescriptor,
	createAgentRunWriter,
} from "@/features/ai/core/ui-message-job-stream";
import type { AgentEventEmitter } from "@/features/ai/pipeline/types";
import type { PipelineLogger } from "./pipeline-logger";

type AgentRunWriter = ReturnType<typeof createAgentRunWriter>;

export function createAgentEventEmitter(
	agentRuns: AgentRunWriter,
	run: AgentRunDescriptor,
	options?: {
		onWarning?: PipelineLogger["warning"];
	},
): AgentEventEmitter {
	return (event) => {
		bridgeAgentRunEvent(
			{
				...event,
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
			},
			agentRuns,
			options?.onWarning
				? (message, meta) => options.onWarning!(message, meta)
				: undefined,
		);
	};
}

export function createPipelineAgentEmitter(
	stageId: string,
	run: AgentRunDescriptor,
	emit: AgentEventEmitter,
): AgentEventEmitter {
	return (event) => {
		emit({
			...event,
			stageId: event.stageId ?? stageId,
			agentRunId: event.agentRunId ?? run.agentRunId,
			label: event.label ?? run.label,
		});
	};
}
