import type { chat } from "@tanstack/ai";
import type { DBQueries } from "@/db/queries";
import { TavilyWebContentProvider } from "@/features/ai/providers/web/tavily-content";
import { TavilyWebSearchProvider } from "@/features/ai/providers/web/tavily-search";
import type { ProviderConfig } from "@/lib/validation";
import { createChatDbTools } from "./db-tools";
import { createChatWebTools, type WebToolsObserver } from "./web-tools";

export type AgentName = "chat" | "reviewer" | "ingest" | "improve_options";
export type BaseToolName = "db_tools" | "web_tools";
export type AgentToolName = BaseToolName | "parallel_review";

export type AgentToolSet = NonNullable<Parameters<typeof chat>[0]["tools"]>;

export interface ToolResolverContext {
	queries: DBQueries;
	providerConfig: ProviderConfig;
	tavilyApiKey?: string;
	webObserver?: WebToolsObserver;
	onWarning?: (message: string) => void | Promise<void>;
}

type BaseToolFactory = (context: ToolResolverContext) => AgentToolSet;

const createDbToolSet: BaseToolFactory = (context) => {
	return createChatDbTools(context.queries) as unknown as AgentToolSet;
};

const createWebToolSet: BaseToolFactory = (context) => {
	if (!context.tavilyApiKey) {
		void context.onWarning?.(
			"web_tools is enabled, but TAVILY_API_KEY is missing. Continuing without web tools.",
		);
		return [] as unknown as AgentToolSet;
	}

	return createChatWebTools(
		new TavilyWebSearchProvider({
			apiKey: context.tavilyApiKey,
		}),
		new TavilyWebContentProvider({
			apiKey: context.tavilyApiKey,
		}),
		context.webObserver,
	) as unknown as AgentToolSet;
};

export const BASE_TOOL_REGISTRY: Record<BaseToolName, BaseToolFactory> = {
	db_tools: createDbToolSet,
	web_tools: createWebToolSet,
};

export const DEFAULT_AGENT_BASE_TOOLS: Record<AgentName, BaseToolName[]> = {
	chat: ["db_tools", "web_tools"],
	reviewer: ["web_tools"],
	ingest: ["web_tools"],
	improve_options: ["web_tools"],
};
