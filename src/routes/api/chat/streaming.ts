import type { StreamChunk } from "@tanstack/ai";
import { toServerSentEventsStream } from "@tanstack/ai";

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
				// Stream was already cancelled/errored by client disconnect
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

export { safeSSEResponse, withCleanup };
