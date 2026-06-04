import type { ModelMessage } from "@tanstack/ai";
import { chatParamsFromRequest } from "@tanstack/ai";
import { buildChatSystemPrompt } from "@/features/ai/agents/chat";
import { streamChatMessages } from "@/features/ai/core/chat-stream";
import { resolveToolsForAgent } from "@/features/ai/tools/tool-resolver";
import { DBQueries } from "../../../db/queries";
import { env } from "../../../env";
import { MemoryManager } from "../../../lib/memory";
import type { ProviderConfig } from "../../../lib/validation";
import { safeSSEResponse, withCleanup } from "./-streaming";
import { summarizeSearchResultSnippets, toBoolean } from "./-tools";

const AI_TIMEOUT_MS = 60_000;

export async function handleChatPost(request: Request): Promise<Response> {
	const { getDB } = await import("../../../server-functions/db");
	let params: Awaited<ReturnType<typeof chatParamsFromRequest>>;
	try {
		params = await chatParamsFromRequest(request);
	} catch (error) {
		if (error instanceof Response) return error;
		throw error;
	}

	const db = await getDB();
	if (!db) {
		return new Response("D1 database not available", { status: 500 });
	}

	const queries = new DBQueries(db);
	const config = await queries.getAllConfig();
	const model = config.ai_model || "openai/gpt-4o-mini";
	const apiKey = config.ai_api_key;
	const provider = config.ai_provider || "openrouter";
	const baseUrl = config.ai_base_url || undefined;

	if (!apiKey) {
		return new Response("AI provider not configured", { status: 400 });
	}
	const reviewMode = toBoolean(params.forwardedProps?.reviewMode);

	console.log(
		`[api.chat] POST model="${model}" provider="${provider}" baseUrl="${baseUrl}" messages=${params.messages.length} reviewMode=${reviewMode}`,
	);

	const abortController = new AbortController();
	const timeoutHandle = setTimeout(() => {
		abortController.abort(
			new Error(`AI request timed out after ${AI_TIMEOUT_MS / 1000}s`),
		);
	}, AI_TIMEOUT_MS);

	const providerConfig: ProviderConfig = {
		provider: provider as ProviderConfig["provider"],
		model,
		baseUrl,
		apiKey,
	};

	const memory = new MemoryManager(db);
	void memory.ensureStructure().catch((error) => {
		console.warn(
			`[api.chat.memory] Unable to initialize memory structure: ${
				error instanceof Error ? error.message : "unknown error"
			}`,
		);
	});

	const resolvedTools = resolveToolsForAgent({
		agent: "chat",
		reviewMode,
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
							sources: output.results.map((result) => result.url),
							conclusion: "Search results collected for factual verification.",
							context: "chat",
						});
					} catch (error) {
						console.warn(
							`[api.chat.memory] Failed to save web search memory: ${
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
							context: "chat",
						});
					} catch (error) {
						console.warn(
							`[api.chat.memory] Failed to save web fetch memory: ${
								error instanceof Error ? error.message : "unknown error"
							}`,
						);
					}
				},
			},
			onWarning: (message) => {
				console.warn(`[api.chat.tools] ${message}`);
			},
		},
	});

	const rawStream = streamChatMessages(
		providerConfig,
		params.messages as Array<ModelMessage>,
		{
			abortController,
			system: buildChatSystemPrompt({ reviewMode }),
			tools: resolvedTools.tools as NonNullable<
				Parameters<typeof streamChatMessages>[2]
			>["tools"],
		},
	);

	const stream = withCleanup(rawStream, () => clearTimeout(timeoutHandle));
	return safeSSEResponse(stream, abortController);
}
