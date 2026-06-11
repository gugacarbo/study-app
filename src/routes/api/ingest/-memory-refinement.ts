import { resolveToolsForAgent } from "@/features/ai/tools/tool-resolver";
import type { ProviderConfig } from "@/lib/validation";
import type { DBQueries } from "../../../db/queries";
import { env } from "../../../env";
import { createIngestLogger } from "../../../lib/logger";
import { MemoryManager } from "../../../lib/memory";
import { summarizeSearchResultSnippets } from "./-review";

interface MemorySetupParams {
	db: D1Database;
	queries: DBQueries;
	providerConfig: ProviderConfig;
	onProgress: (step: string) => void;
	onWarning: (message: string, meta?: Record<string, unknown>) => void;
}

interface MemorySetupResult {
	memory: MemoryManager;
	criticalTopics: string[];
	// biome-ignore lint/suspicious/noExplicitAny: tool type from AI SDK ToolSet
	webTools?: any;
}

export async function setupMemory(
	params: MemorySetupParams,
): Promise<MemorySetupResult> {
	const { db, queries, providerConfig, onWarning } = params;

	const log = createIngestLogger("ingest-pipeline", db);
	const config = await queries.getAllConfig();
	const memory = new MemoryManager(db);

	await memory.ensureStructure().catch((error) => {
		log.error("Memory ensureStructure failed", error, { stage: "init" });
		onWarning(
			`Memory initialization failed: ${
				error instanceof Error ? error.message : "unknown error"
			}`,
		);
	});

	const criticalTopics = getCriticalTopics(
		config.ingest_critical_topics ?? null,
	);

	const resolvedTools = resolveToolsForAgent({
		agent: "ingest",
		config,
		context: {
			queries,
			providerConfig,
			tavilyApiKey: env.TAVILY_API_KEY,
			webObserver: {
				onSearch: async ({ input, output }) => {
					try {
						await memory.saveWebResearch({
							query: input.query,
							summary: summarizeSearchResultSnippets(output.results),
							sources: output.results.map((r) => r.url),
							conclusion: "Search results collected for ingest review.",
							context: "ingest",
						});
					} catch (error) {
						log.error("Failed to save web search memory", error, {
							stage: "web_observer",
							query: input.query,
						});
						onWarning(
							`Failed to save web search memory: ${
								error instanceof Error ? error.message : "unknown error"
							}`,
						);
					}
				},
				onFetch: async ({ output }) => {
					try {
						await memory.saveWebResearch({
							query: `fetch ${output.url}`,
							summary: output.content.slice(0, 1200),
							sources: [output.url],
							conclusion: `Fetched source content: ${output.title}`,
							context: "ingest",
						});
					} catch (error) {
						log.error("Failed to save web fetch memory", error, {
							stage: "web_observer",
							url: output.url,
						});
						onWarning(
							`Failed to save web fetch memory: ${
								error instanceof Error ? error.message : "unknown error"
							}`,
						);
					}
				},
			},
			onWarning,
		},
	});

	const webTools = resolvedTools.tools.length ? resolvedTools.tools : undefined;

	if (!webTools?.length && criticalTopics.length > 0) {
		onWarning(
			"Web tools are unavailable. Review will proceed without web verification.",
		);
	}

	return { memory, criticalTopics, webTools };
}

function getCriticalTopics(value: string | null): string[] {
	if (!value) return [];

	const parsed = (() => {
		try {
			return JSON.parse(value) as unknown;
		} catch {
			return null;
		}
	})();

	const source = Array.isArray(parsed)
		? parsed
				.filter((item): item is string => typeof item === "string")
				.map((t) => t.trim())
		: value.split(/[\n,;]+/).map((p) => p.trim());

	return Array.from(new Set(source.filter(Boolean)));
}
