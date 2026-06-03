import { chat, type StreamChunk } from "@tanstack/ai";
import { createFileRoute } from "@tanstack/react-router";
import { getAiAdapter } from "@/features/ai/adapters/provider-adapter";
import { providerConfigSchema } from "../../lib/validation";

type ConnectionProgressEvent = {
	progress: number;
	step: string;
};

type ConnectionResultEvent = {
	response: string;
};

function formatSSE(event: string, data: unknown): string {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function isTextChunk(
	chunk: StreamChunk,
): chunk is StreamChunk & { delta: string } {
	return (
		chunk.type === "TEXT_MESSAGE_CONTENT" && typeof chunk.delta === "string"
	);
}

async function runConnectionTestWithProgress(
	config: unknown,
	onProgress: (event: ConnectionProgressEvent) => void,
	onPrompt: (prompt: string) => void,
	onChunk: (chunk: string) => void,
	abortSignal: AbortSignal,
): Promise<ConnectionResultEvent> {
	const assertNotAborted = () => {
		if (abortSignal.aborted) {
			throw new Error("Connection test canceled");
		}
	};

	onProgress({ progress: 10, step: "Validating configuration..." });
	const parsed = providerConfigSchema.safeParse(config);
	if (!parsed.success) {
		throw new Error("Invalid provider configuration");
	}
	assertNotAborted();

	onProgress({ progress: 25, step: "Preparing AI adapter..." });
	const adapter = getAiAdapter(parsed.data);
	assertNotAborted();

	const system = "You are a connection test assistant. Respond concisely.";
	const userMsg =
		'Say: "Connection successful using model: <model-name>" and include only one short line.';
	onPrompt(`[System]\n${system}\n\n[User]\n${userMsg}`);

	onProgress({ progress: 40, step: "Connecting to provider..." });

	const stream = chat({
		adapter,
		messages: [{ role: "user", content: userMsg }],
		systemPrompts: [system],
		stream: true,
	});

	let response = "";
	onProgress({ progress: 55, step: "Streaming model response..." });

	for await (const chunk of stream) {
		assertNotAborted();
		if (isTextChunk(chunk) && chunk.delta) {
			response += chunk.delta;
			onChunk(chunk.delta);
		}
	}

	onProgress({ progress: 100, step: "Completed" });
	return { response: response.trim() };
}

export const Route = createFileRoute("/api/test-connection")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				const payload = await request.json().catch(() => null);

				const encoder = new TextEncoder();
				let lastProgress = 0;

				const stream = new ReadableStream<Uint8Array>({
					start(controller) {
						const send = (event: string, data: unknown) => {
							controller.enqueue(encoder.encode(formatSSE(event, data)));
						};

						const sendProgress = (event: ConnectionProgressEvent) => {
							const bounded = Math.max(
								lastProgress,
								Math.min(100, event.progress),
							);
							lastProgress = bounded;
							send("progress", { ...event, progress: bounded });
						};

						void (async () => {
							try {
								const result = await runConnectionTestWithProgress(
									payload,
									sendProgress,
									(prompt) => send("prompt", { prompt }),
									(chunk) => send("chunk", { chunk }),
									request.signal,
								);
								send("result", result);
							} catch (error) {
								send("error", {
									message:
										error instanceof Error
											? error.message
											: "Unknown connection test error",
								});
							} finally {
								controller.close();
							}
						})();
					},
				});

				return new Response(stream, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache, no-transform",
						Connection: "keep-alive",
					},
				});
			},
		},
	},
} as never);
