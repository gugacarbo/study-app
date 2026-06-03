import { createParallelReviewTool } from "./reviewer-tool";
import type {
	AgentName,
	AgentToolName,
	AgentToolSet,
	BaseToolName,
	ToolResolverContext,
} from "./tool-registry";
import { BASE_TOOL_REGISTRY, DEFAULT_AGENT_BASE_TOOLS } from "./tool-registry";

interface ResolveAgentToolsOptions {
	agent: AgentName;
	config: Record<string, string>;
	context: ToolResolverContext;
	reviewMode?: boolean;
}

interface ParsedToolNames {
	names: AgentToolName[];
	isExplicit: boolean;
}

interface ResolvedBaseTools {
	tools: AgentToolSet;
	enabled: BaseToolName[];
	warnings: string[];
}

export interface ResolvedAgentTools extends ResolvedBaseTools {
	enabledAll: AgentToolName[];
}

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

function parseConfiguredToolNames(
	rawValue: string | undefined,
	defaults: AgentToolName[],
): ParsedToolNames {
	if (!rawValue) {
		return {
			names: defaults,
			isExplicit: false,
		};
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
		return {
			names: [],
			isExplicit: true,
		};
	}

	return {
		names: Array.from(new Set(parsed)),
		isExplicit: true,
	};
}

function dedupeTools(tools: AgentToolSet): AgentToolSet {
	const seen = new Set<string>();
	const deduped = tools.filter((tool) => {
		if (seen.has(tool.name)) return false;
		seen.add(tool.name);
		return true;
	});
	return deduped as AgentToolSet;
}

function resolveBaseTools(
	agent: AgentName,
	configuredTools: AgentToolName[],
	useDefaultBaseTools: boolean,
	context: ToolResolverContext,
): ResolvedBaseTools {
	const enabledBase = configuredTools.filter((name): name is BaseToolName =>
		VALID_BASE_TOOL_NAMES.includes(name as BaseToolName),
	);

	const baseToolNames =
		enabledBase.length > 0
			? enabledBase
			: useDefaultBaseTools
				? DEFAULT_AGENT_BASE_TOOLS[agent]
				: [];
	const warnings: string[] = [];
	const toolSet: AgentToolSet = [] as unknown as AgentToolSet;

	for (const baseName of baseToolNames) {
		const factory = BASE_TOOL_REGISTRY[baseName];
		if (!factory) {
			warnings.push(`Unknown base tool set: ${baseName}`);
			continue;
		}
		try {
			const tools = factory(context);
			for (const tool of tools) {
				(toolSet as unknown as Array<(typeof tools)[number]>).push(tool);
			}
		} catch (error) {
			const reason = error instanceof Error ? error.message : "Unknown error";
			warnings.push(`Failed to resolve ${baseName}: ${reason}`);
		}
	}

	return {
		tools: dedupeTools(toolSet),
		enabled: baseToolNames,
		warnings,
	};
}

export function resolveToolsForAgent(
	options: ResolveAgentToolsOptions,
): ResolvedAgentTools {
	const configured = parseConfiguredToolNames(
		options.config[`agent.${options.agent}.tools`],
		DEFAULT_AGENT_TOOL_NAMES[options.agent],
	);
	const configuredNames = configured.names;

	const resolvedBase = resolveBaseTools(
		options.agent,
		configuredNames,
		!configured.isExplicit,
		options.context,
	);

	const enabledAll: AgentToolName[] = Array.from(new Set(configuredNames));
	const warnings = [...resolvedBase.warnings];
	const tools = [...resolvedBase.tools] as AgentToolSet;

	const parallelReviewEnabled = configuredNames.includes("parallel_review");
	if (options.agent === "chat" && parallelReviewEnabled && options.reviewMode) {
		const reviewerConfigured = parseConfiguredToolNames(
			options.config["agent.reviewer.tools"],
			DEFAULT_AGENT_TOOL_NAMES.reviewer,
		);
		const reviewerConfiguredNames = reviewerConfigured.names;

		const reviewerBase = resolveBaseTools(
			"reviewer",
			reviewerConfiguredNames,
			!reviewerConfigured.isExplicit,
			options.context,
		);
		warnings.push(...reviewerBase.warnings);

		tools.push(
			createParallelReviewTool(options.context.providerConfig, {
				reviewerTools: reviewerBase.tools,
				onWarning: options.context.onWarning,
			}),
		);
	}

	for (const warning of warnings) {
		void options.context.onWarning?.(warning);
	}

	return {
		tools: dedupeTools(tools),
		enabled: resolvedBase.enabled,
		enabledAll,
		warnings,
	};
}
