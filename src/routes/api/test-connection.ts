import { createFileRoute } from "@tanstack/react-router";
import { DBQueries } from "@/db/queries";
import { resolveProviderConfigForTest } from "@/lib/ai-config";
import {
	type ConnectionProgressEvent,
	runConnectionTestWithProgress,
} from "@/lib/connection-test";
import { configFormInputSchema } from "@/lib/validation";

function formatSSE(event: string, data: unknown): string {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const Route = createFileRoute("/api/test-connection")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				const payload = await request.json().catch(() => null);
				const parsed = configFormInputSchema.safeParse(payload);
				if (!parsed.success) {
					return new Response("Invalid provider configuration", { status: 400 });
				}

				const { getDB } = await import("../../server-functions/db");
				const db = await getDB();
				if (!db) {
					return new Response("D1 database not available", { status: 500 });
				}

				const queries = new DBQueries(db);
				let providerConfig: Awaited<
					ReturnType<typeof resolveProviderConfigForTest>
				>;
				try {
					providerConfig = await resolveProviderConfigForTest(
						queries,
						parsed.data,
					);
				} catch (error) {
					return new Response(
						error instanceof Error ? error.message : "AI provider not configured",
						{ status: 400 },
					);
				}

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
									providerConfig,
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
