import { frontendTools } from "@assistant-ui/react-ai-sdk";
import type { ToolSet } from "ai";
import type { ToolJSONSchema } from "assistant-stream";
import {
	buildChatPrepareStep,
	buildChatStopWhen,
} from "@/features/ai/core/tool-agent-stop-when";
import { wrapChatToolsWithCallGuards } from "@/features/ai/lib/chat-tool-call-guards";

function mergeChatTools(
	serverTools: ToolSet,
	clientTools: Record<string, ToolJSONSchema>,
): ToolSet {
	const clientToolSet =
		Object.keys(clientTools).length > 0 ? frontendTools(clientTools) : {};
	return {
		...clientToolSet,
		...serverTools,
	};
}

/**
 * Shared chat tool loop config — same stopWhen/prepareStep pattern as
 * `runToolAgentStream` / `runPipelineToolAgent`, but for UI message streaming.
 */
export function buildChatAgentLoopConfig(
	serverTools: ToolSet,
	clientTools: Record<string, ToolJSONSchema> = {},
) {
	const tools = wrapChatToolsWithCallGuards(
		mergeChatTools(serverTools, clientTools),
	);
	const toolNames = Object.keys(tools);

	return {
		tools,
		stopWhen: buildChatStopWhen(),
		prepareStep: buildChatPrepareStep(toolNames),
	};
}
