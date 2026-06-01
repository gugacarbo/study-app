import type { ModelMessage, StreamChunk } from "@tanstack/ai";
import { chatParamsFromRequest, toServerSentEventsStream } from "@tanstack/ai";
import { createFileRoute } from "@tanstack/react-router";
import { buildChatSystemPrompt } from "@/features/ai/agents/chat";
import { streamChatMessages } from "@/features/ai/core/chat-stream";
import { resolveToolsForAgent } from "@/features/ai/tools/tool-resolver";
import { DBQueries } from "../../db/queries";
import { env } from "../../env";
import { MemoryManager } from "../../lib/memory";
import type { ProviderConfig } from "../../lib/validation";

// Timeout for AI provider responses — prevents SSE connections from hanging
// indefinitely if the upstream provider stalls.
const AI_TIMEOUT_MS = 60_000;

function toBoolean(value: unknown): boolean {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		return normalized === "true" || normalized === "1";
	}
	if (typeof value === "number") return value === 1;
	return false;
}

function summarizeSearchResultSnippets(
	results: Array<{ snippet: string }>,
	maxItems: number = 3,
): string {
	const snippets = results
		.map((result) => result.snippet.trim())
		.filter(Boolean)
		.slice(0, maxItems);

	if (snippets.length === 0) {
		return "No snippets available.";
	}

	return snippets.join("\n\n");
}
/**
 * Wraps an async iterable with a cleanup callback that fires when the
 * iterator completes (naturally, via error, or via cancellation).
 */
async function* withCleanup<T>(
	iterable: AsyncIterable<T>,
	cleanup: () => void,
): AsyncGenerator<T> {
	try {
		for await (const chunk of iterable) {
			yield chunk;
		}
	} finally {
		cleanup();
	}
}

/**
 * Safe SSE Response — wraps toServerSentEventsStream and guards against
 * unhandled rejections from controller.close() when the client disconnects
 * (a race between ReadableStream cancel() and the start() callback).
 *
 * The library's toServerSentEventsStream handles the common case, but
 * controller.close() inside its catch block can throw if the stream was
 * already closed/errored by a concurrent cancel(). This wrapper catches
 * those edge cases without losing SSE formatting.
 */
function safeSSEResponse(
	stream: AsyncIterable<StreamChunk>,
	abortController?: AbortController,
): Response {
	const rawStream = toServerSentEventsStream(stream, abortController);
	let rawReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

	const wrappedStream = new ReadableStream({
		async start(controller) {
			rawReader = rawStream.getReader();
			try {
				while (true) {
					const { done, value } = await rawReader.read();
					if (done) break;
					controller.enqueue(value);
				}
				controller.close();
			} catch {
				// Stream was already cancelled/errored by client disconnect —
				// no need to propagate.
			} finally {
				try {
					rawReader?.releaseLock();
				} catch {
					// Ignore lock release errors
				}
				rawReader = null;
			}
		},
		cancel() {
			// Propagate cancellation to the underlying raw stream so its
			// cancel() callback fires → abortController.abort() → chat()
			// generator stops → withCleanup clears the timeout.
			if (rawReader) {
				rawReader.cancel().catch(() => {});
				rawReader = null;
			}
		},
	});

	return new Response(wrappedStream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
}

export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				const { getDB } = await import("../../server-functions/db");
				let params: Awaited<ReturnType<typeof chatParamsFromRequest>>;
				try {
					params = await chatParamsFromRequest(request);
				} catch (error) {
					if (error instanceof Response) {
						return error;
					}
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

				// ----- AbortController with 60s timeout -----
				// If the AI provider (OpenRouter) stalls or the adapter's generator
				// never terminates, the timeout aborts the controller, which causes:
				//  1. chat() internal engine → isCancelled() → break
				//  2. adapter.chatStream() → HTTP request abort (signal forwarded)
				//  3. toServerSentEventsStream → checks signal.aborted → break → close
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
										conclusion:
											"Search results collected for factual verification.",
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
						tools:
							resolvedTools.tools as NonNullable<
								Parameters<typeof streamChatMessages>[2]
							>["tools"],
					},
				);

				// Ensure the timeout is cleared once the stream completes
				const stream = withCleanup(rawStream, () =>
					clearTimeout(timeoutHandle),
				);

				return safeSSEResponse(stream, abortController);
			},
		},
	},
} as any);
