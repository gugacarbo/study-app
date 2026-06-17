import { frontendTools } from "@assistant-ui/react-ai-sdk";
import type { D1Database } from "@cloudflare/workers-types";
import { convertToModelMessages, createUIMessageStreamResponse, type ToolSet } from "ai";
import { buildChatPrepareStep, buildChatStopWhen } from "@/features/ai/core/tool-agent-stop-when";
import { wrapChatToolsWithCallGuards } from "@/features/ai/lib/chat-tool-call-guards";
import type { ToolJSONSchema } from "assistant-stream";
import { getAiModel } from "@/features/ai/adapters/provider-model";
import { buildProviderOptions } from "@/features/ai/adapters/provider-options";
import { buildChatSystemPrompt } from "@/features/ai/agents/chat";
import { loggedStreamText } from "@/features/ai/core/logged-stream-text";
import { mergeStreamResponseHeaders } from "@/features/ai/lib/stream-response-headers";
import { splitThinkTagsInUIMessageStream } from "@/features/ai/lib/split-think-tags-ui-stream";
import { extractChatMessageMetadata } from "@/features/ai/lib/chat-message-metadata";
import { resolveToolsForAgent } from "@/features/ai/tools/tool-resolver";
import {
	type ResolvedModelConfig,
	resolveChatModelConfig,
} from "@/lib/ai-config";
import { createLlmLogCallId, createLlmLogContext } from "@/lib/llm-logging";
import { DBQueries } from "../../../db/queries";
import { env } from "../../../env";
import { MemoryManager } from "../../../lib/memory";
import {
	type ChatRequest,
	parseChatRequest,
	parseClientToolsFromRequest,
} from "./-schema";
import { summarizeSearchResultSnippets } from "./-tools";

const AI_TIMEOUT_MS = 60_000;

function parsePageContextFromMetadata(
	metadata: Record<string, unknown> | undefined,
): import("@/features/ai/context/page-chat-context").PageChatContextPayload | null {
	const raw = metadata?.pageContext;
	if (!raw || typeof raw !== "object") return null;

	const record = raw as Record<string, unknown>;
	if (typeof record.contextKey !== "string") return null;
	if (typeof record.pageType !== "string") return null;
	if (typeof record.label !== "string") return null;
	if (typeof record.route !== "string") return null;

	return {
		contextKey: record.contextKey,
		pageType: record.pageType,
		label: record.label,
		route: record.route,
		...(typeof record.examId === "string" ? { examId: record.examId } : {}),
		...(typeof record.questionId === "string"
			? { questionId: record.questionId }
			: {}),
		...(typeof record.summary === "string" ? { summary: record.summary } : {}),
	};
}

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

async function runChatStream({
	request,
	body,
	providerConfig,
	queries,
	db,
}: {
	request: Request;
	body: ChatRequest;
	providerConfig: ResolvedModelConfig;
	queries: DBQueries;
	db: D1Database;
}): Promise<Response> {
	const { messages, reviewMode, conversationId } = body;

	const abortController = new AbortController();
	const timeoutHandle = setTimeout(() => {
		abortController.abort(
			new Error(`AI request timed out after ${AI_TIMEOUT_MS / 1000}s`),
		);
	}, AI_TIMEOUT_MS);

	const cleanup = () => {
		clearTimeout(timeoutHandle);
	};
	const onAbort = () => {
		cleanup();
		abortController.abort();
	};
	request.signal.addEventListener("abort", onAbort, { once: true });

	const config = await queries.getAllConfig();
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

	const tools = wrapChatToolsWithCallGuards(
		mergeChatTools(resolvedTools.tools, parseClientToolsFromRequest(body)),
	);
	const chatToolNames = Object.keys(tools);

	const pageContext = parsePageContextFromMetadata(body.metadata);
	const chatSystemPrompt = buildChatSystemPrompt({ reviewMode, pageContext });
	const chatCallId = createLlmLogCallId("chat");

	const result = loggedStreamText(
		createLlmLogContext("chat", providerConfig, {
			callId: chatCallId,
			systemPrompt: chatSystemPrompt,
			requestSummary: `${messages.length} messages`,
			metadata: {
				reviewMode,
				conversationId,
				...(body.metadata ?? {}),
			},
		}),
		{
			model: getAiModel(providerConfig),
			system: chatSystemPrompt,
			messages: await convertToModelMessages(messages),
			tools,
			stopWhen: buildChatStopWhen(),
			prepareStep: buildChatPrepareStep(chatToolNames),
			providerOptions: buildProviderOptions(providerConfig),
			abortSignal: abortController.signal,
		},
		db,
	);

	return createUIMessageStreamResponse({
		stream: splitThinkTagsInUIMessageStream(
			result.toUIMessageStream({
				originalMessages: messages,
				onFinish: cleanup,
				messageMetadata: ({ part }) => extractChatMessageMetadata(part),
			}),
		),
		headers: mergeStreamResponseHeaders(),
	});
}

export async function handleChatPost(request: Request): Promise<Response> {
	const { getDB } = await import("../../../server-functions/db");

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return new Response("Invalid chat request body", { status: 400 });
	}

	const parsed = parseChatRequest(payload);
	if (!parsed.ok) return parsed.response;

	const { data: body } = parsed;
	const { messages, reviewMode, modelId, conversationId } = body;

	const db = await getDB();
	if (!db) {
		return new Response("D1 database not available", { status: 500 });
	}

	const queries = new DBQueries(db);
	const providerConfig = await resolveChatModelConfig(queries, modelId);
	if (!providerConfig) {
		return new Response("AI provider not configured", { status: 400 });
	}

	console.log(
		`[api.chat] POST model="${providerConfig.model}" baseUrl="${providerConfig.baseUrl}" messages=${messages.length} reviewMode=${reviewMode}${conversationId ? ` conversationId=${conversationId}` : ""}`,
	);

	return runChatStream({
		request,
		body,
		providerConfig,
		queries,
		db,
	});
}
