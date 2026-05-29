import type { D1Database } from "@cloudflare/workers-types";
import type { StreamChunk } from "@tanstack/ai";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DBQueries } from "../../db/queries";
import { extractQuestionsFromText } from "../../lib/ai/prompts/extract-questions";
import { FileService } from "../../lib/file-service";
import { MemoryManager } from "../../lib/memory";
import { providerConfigSchema } from "../../lib/validation";
import { getDB } from "../../server-functions/db";

const ingestRequestSchema = z.object({
	buffer: z.array(z.number()),
	fileName: z.string(),
	config: providerConfigSchema,
});

type IngestRequest = z.infer<typeof ingestRequestSchema>;

function extractTextFromBytes(bytes: Uint8Array): string {
	const text = new TextDecoder().decode(bytes);
	return text.replace(/[^\x20-\x7E\n\r\t]/g, " ").trim();
}

function formatSSE(event: string, data: unknown): string {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
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
	const assertNotAborted = () => {
		if (abortSignal.aborted) {
			throw new Error("Upload canceled");
		}
	};

	const onProgress = (step: string) => {
		send("progress", { step });
	};

	const onAiChunk = (chunk: StreamChunk) => {
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
	assertNotAborted();

	const queries = new DBQueries(db);
	const fileService = new FileService(db);

	onProgress("Decoding file...");
	const bytes = new Uint8Array(payload.buffer);
	const text = extractTextFromBytes(bytes);
	assertNotAborted();

	if (!text || text.length < 50) {
		throw new Error(
			"Could not extract enough text from file. Try pasting text manually.",
		);
	}

	onProgress("Extracting questions with AI...");
	const extracted = await extractQuestionsFromText(
		payload.config,
		text,
		undefined,
		{
			onChunk: onAiChunk,
		},
	);
	onProgress("Initial extraction completed");
	assertNotAborted();

	onProgress("Loading study-memory context...");
	const memoryContext = await getMemoryContextForTopics(
		db,
		extracted.topics,
	).catch(() => "");
	assertNotAborted();

	let finalExtracted = extracted;
	if (memoryContext) {
		onProgress("Refining extraction with memory context...");
		finalExtracted = await extractQuestionsFromText(
			payload.config,
			text,
			memoryContext,
			{ onChunk: onAiChunk },
		);
		onProgress("Memory refinement completed");
		assertNotAborted();
	}

	onProgress("Saving exam...");
	const examId = await queries.insertExam(payload.fileName, "upload");

	if (finalExtracted.questions.length > 0) {
		onProgress("Saving extracted questions...");
		await queries.insertQuestions(examId, finalExtracted.questions);
	}

	onProgress("Saving original file...");
	const mimeType = FileService.inferMimeType(payload.fileName);
	const fileId = await fileService.save(
		examId,
		payload.fileName,
		payload.buffer,
		mimeType,
	);

	onProgress("Completed");
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
			POST: async ({ request }) => {
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
});
