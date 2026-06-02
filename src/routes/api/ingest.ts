import type { D1Database } from "@cloudflare/workers-types";
import type { StreamChunk, StructuredOutputCompleteEvent } from "@tanstack/ai";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
	extractQuestionsFromText,
	reviewExtractionForCriticalTopics,
} from "@/features/ai/agents/ingest";
import { resolveToolsForAgent } from "@/features/ai/tools/tool-resolver";
import type { ExamIngestResponse } from "@/lib/validation";
import { DBQueries } from "../../db/queries";
import { env } from "../../env";
import { FileService } from "../../lib/file-service";
import { MemoryManager } from "../../lib/memory";
import { providerConfigSchema } from "../../lib/validation";

const ingestRequestSchema = z.object({
	buffer: z.array(z.number()),
	fileName: z.string(),
	config: providerConfigSchema,
	enableReview: z.boolean().optional().default(true),
});

type IngestRequest = z.infer<typeof ingestRequestSchema>;
type AgentTools = NonNullable<
	Parameters<typeof extractQuestionsFromText>[3]
>["tools"];

function extractTextFromBytes(bytes: Uint8Array): string {
	const text = new TextDecoder().decode(bytes);
	return text.replace(/[^\x20-\x7E\n\r\t]/g, " ").trim();
}

function formatSSE(event: string, data: unknown): string {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

type StageStatus = "pending" | "running" | "done" | "warning" | "error";

function sendStage(
	send: (event: string, data: unknown) => void,
	stageId: string,
	label: string,
	status: StageStatus,
	meta?: Record<string, unknown>,
) {
	send("stage", { stageId, label, status, timestamp: Date.now(), meta });
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

function parseCriticalTopics(value: string | null): string[] {
	if (!value) return [];

	// Accept either delimited plain text or a JSON array string.
	const parsedJson = (() => {
		try {
			return JSON.parse(value) as unknown;
		} catch {
			return null;
		}
	})();

	if (Array.isArray(parsedJson)) {
		return Array.from(
			new Set(
				parsedJson
					.filter((item): item is string => typeof item === "string")
					.map((topic) => topic.trim())
					.filter(Boolean),
			),
		);
	}

	return Array.from(
		new Set(
			value
				.split(/[\n,;]+/)
				.map((part) => part.trim())
				.filter(Boolean),
		),
	);
}

async function getMemoryContextForTopics(
	db: D1Database,
	topics: string[],
): Promise<string> {
	const memory = new MemoryManager(db);
	await memory.ensureStructure();
	return await memory.buildMemoryPrompt(topics);
}

async function runIngestWithProgress(
	payload: IngestRequest,
	send: (event: string, data: unknown) => void,
	abortSignal: AbortSignal,
) {
	const { getDB } = await import("../../server-functions/db");
	const { getFilesBucket } = await import("../../server-functions/storage");
	const assertNotAborted = () => {
		if (abortSignal.aborted) {
			throw new Error("Upload canceled");
		}
	};

	const onProgress = (step: string) => {
		send("progress", { step });
	};

	const onAiChunk = (
		chunk: StreamChunk | StructuredOutputCompleteEvent<ExamIngestResponse>,
	) => {
		// Raw text from generic streaming chunks
		if (
			"content" in chunk &&
			typeof chunk.content === "string" &&
			chunk.content
		) {
			send("chunk", { text: chunk.content });
		}
		// Raw JSON from structured-output chunks (the actual extraction text)
		if (
			"value" in chunk &&
			chunk.value &&
			typeof chunk.value === "object" &&
			"raw" in chunk.value &&
			typeof chunk.value.raw === "string"
		) {
			send("chunk", { text: chunk.value.raw });
		}
		// Token usage at end of AI run
		if ("usage" in chunk && chunk.usage) {
			send("token", chunk.usage);
		}
	};

	onProgress("Connecting to database...");
	const db = await getDB();
	if (!db) {
		throw new Error("D1 database not available");
	}
	const queries = new DBQueries(db);
	const config = await queries.getAllConfig();
	const memory = new MemoryManager(db);
	await memory.ensureStructure().catch((error) => {
		send("warning", {
			message: `Memory initialization failed: ${
				error instanceof Error ? error.message : "unknown error"
			}`,
		});
	});

	const criticalTopics = parseCriticalTopics(
		config.ingest_critical_topics ?? null,
	);
	const resolvedTools = resolveToolsForAgent({
		agent: "ingest",
		config,
		context: {
			queries,
			providerConfig: payload.config,
			tavilyApiKey: env.TAVILY_API_KEY,
			webObserver: {
				onSearch: async ({ input, output }) => {
					try {
						await memory.saveWebResearch({
							query: input.query,
							summary: summarizeSearchResultSnippets(output.results),
							sources: output.results.map((result) => result.url),
							conclusion:
								"Search results collected for ingest critical-topic verification.",
							context: "ingest",
						});
					} catch (error) {
						send("warning", {
							message: `Failed to save web search memory: ${
								error instanceof Error ? error.message : "unknown error"
							}`,
						});
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
						send("warning", {
							message: `Failed to save web fetch memory: ${
								error instanceof Error ? error.message : "unknown error"
							}`,
						});
					}
				},
			},
			onWarning: (message) => send("warning", { message }),
		},
	});
	const webTools = resolvedTools.tools.length
		? (resolvedTools.tools as AgentTools)
		: undefined;

	if (!webTools?.length && criticalTopics.length > 0) {
		send("warning", {
			message:
				"Web tools are unavailable. Review will proceed without web verification.",
		});
	}
	const filesBucket = await getFilesBucket();
	if (!filesBucket) {
		throw new Error("R2 FILES_BUCKET binding is not available");
	}
	assertNotAborted();

	const fileService = new FileService(db, filesBucket);

	onProgress("Decoding file...");
	sendStage(send, "decode", "Decoding file", "running");
	const bytes = new Uint8Array(payload.buffer);
	const text = extractTextFromBytes(bytes);
	sendStage(send, "decode", "Decoding file", "done");
	assertNotAborted();

	if (!text || text.length < 50) {
		throw new Error(
			"Could not extract enough text from file. Try pasting text manually.",
		);
	}

	onProgress("Extracting questions with AI...");
	sendStage(
		send,
		"initial_extraction",
		"Extracting questions with AI",
		"running",
	);
	let extracted: ExamIngestResponse;
	try {
		extracted = await extractQuestionsFromText(
			payload.config,
			text,
			undefined,
			{
				onChunk: onAiChunk,
				tools: webTools,
				criticalTopics,
				enableWebVerification: Boolean(webTools?.length),
			},
		);
	} catch (err) {
		sendStage(
			send,
			"initial_extraction",
			"Extracting questions with AI",
			"error",
			{ error: err instanceof Error ? err.message : "unknown" },
		);
		throw err;
	}
	sendStage(send, "initial_extraction", "Extracting questions with AI", "done");
	onProgress("Initial extraction completed");
	assertNotAborted();

	onProgress("Loading study-memory context...");
	sendStage(send, "memory_context", "Loading study-memory context", "running");
	const memoryContext = await getMemoryContextForTopics(
		db,
		extracted.topics,
	).catch(() => "");
	sendStage(send, "memory_context", "Loading study-memory context", "done");
	assertNotAborted();

	let finalExtracted: ExamIngestResponse = extracted;
	if (memoryContext) {
		onProgress("Refining extraction with memory context...");
		sendStage(
			send,
			"memory_refinement",
			"Refining extraction with memory context",
			"running",
		);
		try {
			finalExtracted = await extractQuestionsFromText(
				payload.config,
				text,
				memoryContext,
				{
					onChunk: onAiChunk,
					tools: webTools,
					criticalTopics,
					enableWebVerification: Boolean(webTools?.length),
				},
			);
		} catch (err) {
			sendStage(
				send,
				"memory_refinement",
				"Refining extraction with memory context",
				"error",
				{ error: err instanceof Error ? err.message : "unknown" },
			);
			throw err;
		}
		sendStage(
			send,
			"memory_refinement",
			"Refining extraction with memory context",
			"done",
		);
		onProgress("Memory refinement completed");
		assertNotAborted();
	}

	if (payload.enableReview) {
		const reviewTopics =
			criticalTopics.length > 0
				? criticalTopics
				: finalExtracted.topics;
		onProgress("Running critical-topic verification...");
		sendStage(
			send,
			"critical_topic_verification",
			"Critical topic verification",
			"running",
		);
		let reviewResult: {
			extracted: ExamIngestResponse;
			reviewed: boolean;
			criticalTopicsMatched: string[];
			reasons: string[];
		};
		try {
			reviewResult = await reviewExtractionForCriticalTopics(
				payload.config,
				text,
				finalExtracted,
				{
					criticalTopics: reviewTopics,
					tools: webTools,
					onEvent: (event) => {
						if (event.type === "warning") {
							send("warning", { message: event.message });
							return;
						}
						onProgress(event.message);
					},
				},
			);
		} catch (err) {
			sendStage(
				send,
				"critical_topic_verification",
				"Critical topic verification",
				"error",
				{ error: err instanceof Error ? err.message : "unknown" },
			);
			throw err;
		}
		sendStage(
			send,
			"critical_topic_verification",
			"Critical topic verification",
			"done",
			reviewResult.reviewed
				? {
						reviewed: true,
						matchedTopics: reviewResult.criticalTopicsMatched.length,
					}
				: undefined,
		);
		finalExtracted = reviewResult.extracted;
		if (reviewResult.reviewed) {
			onProgress("Critical-topic review completed");
		} else {
			onProgress("Critical-topic review skipped");
		}
		if (
			reviewResult.criticalTopicsMatched.length > 0 &&
			reviewResult.reasons.includes("web_tools_unavailable")
		) {
			send("warning", {
				message:
					"Critical topics were detected but web verification was unavailable. Saved extraction is best-effort.",
			});
		}
		assertNotAborted();
	} else {
		onProgress("Critical-topic review disabled for this ingest.");
		sendStage(
			send,
			"critical_topic_verification",
			"Critical topic verification",
			"warning",
			{ disabled: true },
		);
	}

	onProgress("Saving exam...");
	sendStage(send, "persist_exam", "Saving exam record", "running");
	let examId: number;
	try {
		examId = await queries.insertExam(payload.fileName, "upload");
	} catch (err) {
		sendStage(send, "persist_exam", "Saving exam record", "error", {
			error: err instanceof Error ? err.message : "unknown",
		});
		throw err;
	}
	sendStage(send, "persist_exam", "Saving exam record", "done");

	if (finalExtracted.questions.length > 0) {
		onProgress("Saving extracted questions...");
		sendStage(
			send,
			"persist_questions",
			"Saving extracted questions",
			"running",
		);
		try {
			await queries.insertQuestions(examId, finalExtracted.questions);
		} catch (err) {
			sendStage(
				send,
				"persist_questions",
				"Saving extracted questions",
				"error",
				{ error: err instanceof Error ? err.message : "unknown" },
			);
			throw err;
		}
		sendStage(send, "persist_questions", "Saving extracted questions", "done");
	}

	onProgress("Saving original file...");
	sendStage(send, "persist_file", "Saving original file", "running");
	const mimeType = FileService.inferMimeType(payload.fileName);
	let fileId: number;
	try {
		fileId = await fileService.save(
			examId,
			payload.fileName,
			payload.buffer,
			mimeType,
		);
	} catch (err) {
		sendStage(send, "persist_file", "Saving original file", "error", {
			error: err instanceof Error ? err.message : "unknown",
		});
		throw err;
	}
	sendStage(send, "persist_file", "Saving original file", "done");

	onProgress("Completed");
	sendStage(send, "complete", "Ingest complete", "done");
	return {
		questions: finalExtracted.questions.length,
		topics: finalExtracted.topics,
		examId,
		fileId,
	};
}

export const Route = createFileRoute("/api/ingest")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				const payloadRaw = await request.json().catch(() => null);
				const parsed = ingestRequestSchema.safeParse(payloadRaw);
				if (!parsed.success) {
					return new Response(
						JSON.stringify({
							error: "Invalid ingest payload",
							details: parsed.error.issues,
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const encoder = new TextEncoder();

				const stream = new ReadableStream<Uint8Array>({
					start(controller) {
						const send = (event: string, data: unknown) => {
							controller.enqueue(encoder.encode(formatSSE(event, data)));
						};

						void (async () => {
							try {
								const result = await runIngestWithProgress(
									parsed.data,
									send,
									request.signal,
								);
								send("result", result);
							} catch (error) {
								send("error", {
									message:
										error instanceof Error
											? error.message
											: "Unknown ingest error",
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
} as any);
