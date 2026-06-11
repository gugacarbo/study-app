import { createParallelReviewTool } from "../reviewer-tool";
import type {
	AgentName,
	AgentToolName,
	AgentToolSet,
	BaseToolName,
	ToolResolverContext,
} from "../tool-registry";
import { BASE_TOOL_REGISTRY, DEFAULT_AGENT_BASE_TOOLS } from "../tool-registry";
import {
	DEFAULT_AGENT_TOOL_NAMES,
	parseConfiguredToolNames,
	VALID_BASE_TOOL_NAMES,
} from "./definitions";

interface ResolveAgentToolsOptions {
	agent: AgentName;
	config: Record<string, string>;
	context: ToolResolverContext;
	reviewMode?: boolean;
}

interface ResolvedBaseTools {
	tools: AgentToolSet;
	enabled: BaseToolName[];
	warnings: string[];
}

export interface ResolvedAgentTools extends ResolvedBaseTools {
	enabledAll: AgentToolName[];
}

function mergeToolSets(...sets: AgentToolSet[]): AgentToolSet {
	const merged: AgentToolSet = {};
	for (const set of sets) {
		for (const [name, definition] of Object.entries(set)) {
			if (merged[name]) continue;
			merged[name] = definition;
		}
	}
	return merged;
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
	const toolSets: AgentToolSet[] = [];

	for (const baseName of baseToolNames) {
		const factory = BASE_TOOL_REGISTRY[baseName];
		if (!factory) {
			warnings.push(`Unknown base tool set: ${baseName}`);
			continue;
		}
		try {
			toolSets.push(factory(context));
		} catch (error) {
			const reason = error instanceof Error ? error.message : "Unknown error";
			warnings.push(`Failed to resolve ${baseName}: ${reason}`);
		}
	}

	return {
		tools: mergeToolSets(...toolSets),
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
	let tools = { ...resolvedBase.tools };

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

		tools = mergeToolSets(tools, {
			parallel_review: createParallelReviewTool(
				options.context.providerConfig,
				{
					reviewerTools: reviewerBase.tools,
					onWarning: options.context.onWarning,
				},
			),
		});
	}

	for (const warning of warnings) {
		void options.context.onWarning?.(warning);
	}

	return {
		tools,
		enabled: resolvedBase.enabled,
		enabledAll,
		warnings,
	};
}
