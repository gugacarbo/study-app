import type { AgentName, AgentToolName, BaseToolName } from "./tool-registry";
import { BASE_TOOL_REGISTRY } from "./tool-registry";

const VALID_BASE_TOOL_NAMES = Object.keys(BASE_TOOL_REGISTRY) as BaseToolName[];

const VALID_ALL_TOOL_NAMES: AgentToolName[] = [
	...VALID_BASE_TOOL_NAMES,
	"parallel_review",
];

const DEFAULT_AGENT_TOOL_NAMES: Record<AgentName, AgentToolName[]> = {
	chat: ["db_tools", "web_tools", "parallel_review"],
	reviewer: ["web_tools"],
	ingest: ["web_tools"],
};

interface ParsedToolNames {
	names: AgentToolName[];
	isExplicit: boolean;
}

function parseConfiguredToolNames(
	rawValue: string | undefined,
	defaults: AgentToolName[],
): ParsedToolNames {
	if (!rawValue) {
		return { names: defaults, isExplicit: false };
	}

	const parsed = rawValue
		.split(/[\n,]/)
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map((entry) => entry.toLowerCase())
		.filter((entry): entry is AgentToolName =>
			VALID_ALL_TOOL_NAMES.includes(entry as AgentToolName),
		);

	if (parsed.length === 0) {
		return { names: [], isExplicit: true };
	}

	return {
		names: Array.from(new Set(parsed)),
		isExplicit: true,
	};
}

export type { ParsedToolNames };
export {
	DEFAULT_AGENT_TOOL_NAMES,
	parseConfiguredToolNames,
	VALID_ALL_TOOL_NAMES,
	VALID_BASE_TOOL_NAMES,
};
