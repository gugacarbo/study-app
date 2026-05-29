import type { ModelMessage, StreamChunk } from "@tanstack/ai";
import { toServerSentEventsStream } from "@tanstack/ai";
import { createFileRoute } from "@tanstack/react-router";
import { DBQueries } from "../../db/queries";
import { streamChatMessages } from "../../lib/ai/ai";
import { createChatDbTools } from "../../lib/ai/chat-db-tools";
import type { ProviderConfig } from "../../lib/validation";

// Timeout for AI provider responses — prevents SSE connections from hanging
// indefinitely if the upstream provider stalls.
const AI_TIMEOUT_MS = 60_000;
const CHAT_SYSTEM_PROMPT = `You are a helpful study assistant for this app.

When the user asks for factual data from the app database (exams, questions, answer keys, attempts), call the available tools first instead of guessing.
Use tools only on-demand for factual lookups. Do not call tools for generic tutoring, explanations, or brainstorming.
If tool data is unavailable, say so briefly and continue with best-effort guidance.`;

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
				const body = (await request.json()) as {
					messages: { role: string; content: string }[];
				};

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

				console.log(
					`[api.chat] POST model="${model}" provider="${provider}" baseUrl="${baseUrl}" messages=${body.messages.length}`,
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

				const rawStream = streamChatMessages(
					providerConfig,
					body.messages as Array<ModelMessage>,
					{
						abortController,
						system: CHAT_SYSTEM_PROMPT,
						tools: [...createChatDbTools(queries)],
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
