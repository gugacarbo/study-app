import { frontendTools } from "@assistant-ui/react-ai-sdk";
import type { ToolJSONSchema } from "assistant-stream";
import {
	convertToModelMessages,
	stepCountIs,
	streamText,
	type ToolSet,
	type UIMessage,
} from "ai";
import { buildProviderOptions } from "@/features/ai/adapters/provider-options";
import { getAiModel } from "@/features/ai/adapters/provider-model";
import { buildChatSystemPrompt } from "@/features/ai/agents/chat";
import { mergeStreamResponseHeaders } from "@/features/ai/lib/stream-response-headers";
import { resolveToolsForAgent } from "@/features/ai/tools/tool-resolver";
import { DBQueries } from "../../../db/queries";
import { env } from "../../../env";
import { requireModelConfig } from "../../../lib/ai-config";
import { MemoryManager } from "../../../lib/memory";
import { summarizeSearchResultSnippets, toBoolean } from "./-tools";

const AI_TIMEOUT_MS = 60_000;

interface ChatRequestBody {
	messages?: UIMessage[];
	tools?:
		| Record<string, ToolJSONSchema>
		| Array<{
				name: string;
				description?: string;
				parameters: ToolJSONSchema["parameters"];
		  }>;
	forwardedProps?: Record<string, unknown>;
	reviewMode?: unknown;
	metadata?: Record<string, unknown>;
}

function parseChatRequestBody(body: unknown): ChatRequestBody {
	if (!body || typeof body !== "object") {
		throw new Response("Invalid chat request body", { status: 400 });
	}
	return body as ChatRequestBody;
}

function parseClientTools(
	body: ChatRequestBody,
): Record<string, ToolJSONSchema> {
	if (!body.tools) return {};

	if (Array.isArray(body.tools)) {
		return Object.fromEntries(
			body.tools.map((tool) => [
				tool.name,
				{
					...(tool.description !== undefined
						? { description: tool.description }
						: {}),
					parameters: tool.parameters,
				},
			]),
		);
	}

	return body.tools;
}

function readReviewMode(body: ChatRequestBody): boolean {
	return toBoolean(
		body.forwardedProps?.reviewMode ?? body.reviewMode ?? body.metadata?.reviewMode,
	);
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

export async function handleChatPost(request: Request): Promise<Response> {
	const { getDB } = await import("../../../server-functions/db");

	let body: ChatRequestBody;
	try {
		body = parseChatRequestBody(await request.json());
	} catch (error) {
		if (error instanceof Response) return error;
		return new Response("Invalid chat request body", { status: 400 });
	}

	const messages = body.messages;
	if (!Array.isArray(messages) || messages.length === 0) {
		return new Response("messages are required", { status: 400 });
	}

	const db = await getDB();
	if (!db) {
		return new Response("D1 database not available", { status: 500 });
	}

	const queries = new DBQueries(db);
	const config = await queries.getAllConfig();
	let providerConfig: Awaited<ReturnType<typeof requireModelConfig>>;
	try {
		providerConfig = await requireModelConfig(queries, "chat");
	} catch {
		return new Response("AI provider not configured", { status: 400 });
	}

	const reviewMode = readReviewMode(body);

	console.log(
		`[api.chat] POST model="${providerConfig.model}" baseUrl="${providerConfig.baseUrl}" messages=${messages.length} reviewMode=${reviewMode}`,
	);

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

	const tools = mergeChatTools(
		resolvedTools.tools,
		parseClientTools(body),
	);

	const result = streamText({
		model: getAiModel(providerConfig),
		system: buildChatSystemPrompt({ reviewMode }),
		messages: await convertToModelMessages(messages),
		tools,
		stopWhen: stepCountIs(10),
		providerOptions: buildProviderOptions(providerConfig),
		abortSignal: abortController.signal,
	});

	return result.toUIMessageStreamResponse({
		originalMessages: messages,
		headers: mergeStreamResponseHeaders(),
		onFinish: cleanup,
	});
}
