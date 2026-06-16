import type { ToolSet } from "ai";
import type { DBQueries } from "@/db/queries";
import { TavilyWebContentProvider } from "@/features/ai/providers/web/tavily-content";
import { TavilyWebSearchProvider } from "@/features/ai/providers/web/tavily-search";
import type { ProviderConfig } from "@/lib/validation";
import { createChatDbTools } from "./db-tools";
import { createSpellTools } from "./spell-tools";
import { createChatWebTools, type WebToolsObserver } from "./web-tools";

export type AgentName = "chat" | "reviewer" | "ingest" | "improve_questions" | "explanations";
export type BaseToolName = "db_tools" | "web_tools" | "spell_tools";
export type AgentToolName = BaseToolName | "parallel_review";

export type AgentToolSet = ToolSet;

export interface ToolResolverContext {
	queries: DBQueries;
	providerConfig: ProviderConfig;
	tavilyApiKey?: string;
	webObserver?: WebToolsObserver;
	onWarning?: (message: string) => void | Promise<void>;
}

type BaseToolFactory = (context: ToolResolverContext) => AgentToolSet;

const createDbToolSet: BaseToolFactory = (context) => {
	return createChatDbTools(context.queries);
};

const createWebToolSet: BaseToolFactory = (context) => {
	if (!context.tavilyApiKey) {
		void context.onWarning?.(
			"web_tools is enabled, but TAVILY_API_KEY is missing. Continuing without web tools.",
		);
		return {};
	}

	return createChatWebTools(
		new TavilyWebSearchProvider({
			apiKey: context.tavilyApiKey,
		}),
		new TavilyWebContentProvider({
			apiKey: context.tavilyApiKey,
		}),
		context.webObserver,
	);
};

const createSpellToolSet: BaseToolFactory = () => createSpellTools();

export const BASE_TOOL_REGISTRY: Record<BaseToolName, BaseToolFactory> = {
	db_tools: createDbToolSet,
	web_tools: createWebToolSet,
	spell_tools: createSpellToolSet,
};

export const DEFAULT_AGENT_BASE_TOOLS: Record<AgentName, BaseToolName[]> = {
	chat: ["db_tools", "web_tools"],
	reviewer: ["web_tools"],
	ingest: ["web_tools"],
	improve_questions: ["web_tools", "spell_tools"],
	explanations: ["web_tools"],
};
