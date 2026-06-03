import type { D1Database } from "@cloudflare/workers-types";
import type { StreamChunk, StructuredOutputCompleteEvent } from "@tanstack/ai";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { reviewExtraction } from "@/features/ai/agents/ingest";
import { buildSystemPrompt } from "@/features/ai/agents/ingest/system-prompt";
import { generateJsonStream } from "@/features/ai/core/generate";
import { resolveToolsForAgent } from "@/features/ai/tools/tool-resolver";
import type { ExamIngestResponse } from "@/lib/validation";
import { examIngestResponseSchema } from "@/lib/validation";
import { DBQueries } from "../../db/queries";
import { env } from "../../env";
import { FileService } from "../../lib/file-service";
import { createIngestLogger } from "../../lib/logger";
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
	Parameters<typeof generateJsonStream>[3]
>["tools"];

function extractTextFromBytes(bytes: Uint8Array): string {
	const text = new TextDecoder().decode(bytes);
	// Remove only true control characters (C0 except TAB/LF/CR, and DEL).
	// Preserves all Unicode — accents, cedilla, em-dash, bullets, etc.
	// Uses functional approach to avoid Biome's noControlCharactersInRegex rule.
	return [...text]
		.filter((char) => {
			const code = char.codePointAt(0);
			if (code === undefined) return false;
			if (code === 9 || code === 10 || code === 13) return true; // TAB, LF, CR
			if (code <= 31 || code === 127) return false; // C0 controls & DEL
			return true;
		})
		.join("")
		.trim();
}

function formatSSE(event: string, data: unknown): string {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

type StageStatus =
	| "pending"
	| "running"
	| "done"
	| "warning"
	| "error"
	| "skipped";
type AgentRunStatus = "pending" | "running" | "done" | "error" | "skipped";
type AgentRunEventType = "lifecycle" | "result" | "warning" | "token";

interface AgentRunDescriptor {
	stageId: string;
	agentRunId: string;
	label: string;
}

interface AgentRunEvent {
	eventType: AgentRunEventType;
	stageId: string;
	agentRunId: string;
	label: string;
	timestamp: number;
	status?: AgentRunStatus;
	systemPrompt?: string;
	userPrompt?: string;
	rawText?: string;
	finalObject?: unknown;
	error?: string;
	warning?: string;
	tokens?: unknown;
	meta?: Record<string, unknown>;
}

function isTextChunk(
	chunk: unknown,
): chunk is { type: "TEXT_MESSAGE_CONTENT"; delta: string } {
	return (
		typeof chunk === "object" &&
		chunk !== null &&
		"type" in chunk &&
		chunk.type === "TEXT_MESSAGE_CONTENT" &&
		"delta" in chunk &&
		typeof chunk.delta === "string"
	);
}

function sendStage(
	send: (event: string, data: unknown) => void,
	stageId: string,
	label: string,
	status: StageStatus,
	meta?: Record<string, unknown>,
) {
	send("stage", { stageId, label, status, timestamp: Date.now(), meta });
}

function buildExtractionUserPrompt(text: string): string {
	return `
    Extract all exam questions from the following text.
    Return ONLY a valid JSON object with this exact structure:
    {
      "questions": [
        {
          "question": "the question text",
          "options": ["option a", "option b", "option c", "option d"],
          "answer": "the correct answer text",
          "explanation": "",
          "topic": "subject/topic name"
        }
      ],
      "topics": ["list", "of", "unique", "topics"]
    }

    Text to extract from:
    ${text}
  `;
}

function createAgentRunHelpers(send: (event: string, data: unknown) => void) {
	let runCounter = 0;

	const sendAgentRun = (event: Omit<AgentRunEvent, "timestamp">) => {
		send("agent", { ...event, timestamp: Date.now() });
	};

	return {
		createRun(stageId: string, label: string): AgentRunDescriptor {
			runCounter += 1;
			return {
				stageId,
				label,
				agentRunId: `${stageId}-${runCounter}`,
			};
		},
		lifecycle(
			run: AgentRunDescriptor,
			status: AgentRunStatus,
			meta?: Omit<
				AgentRunEvent,
				| "eventType"
				| "stageId"
				| "agentRunId"
				| "label"
				| "timestamp"
				| "status"
			>,
		) {
			sendAgentRun({
				eventType: "lifecycle",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				status,
				...meta,
			});
		},
		result(
			run: AgentRunDescriptor,
			finalObject: unknown,
			rawText?: string,
			meta?: Record<string, unknown>,
		) {
			sendAgentRun({
				eventType: "result",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				finalObject,
				rawText,
				meta,
			});
		},
		warning(
			run: AgentRunDescriptor,
			warning: string,
			meta?: Record<string, unknown>,
		) {
			sendAgentRun({
				eventType: "warning",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				warning,
				meta,
			});
		},
		token(
			run: AgentRunDescriptor,
			tokens: unknown,
			meta?: Record<string, unknown>,
		) {
			sendAgentRun({
				eventType: "token",
				stageId: run.stageId,
				agentRunId: run.agentRunId,
				label: run.label,
				tokens,
				meta,
			});
		},
	};
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
		} catch (parseError) {
			console.warn("Failed to parse critical topics as JSON:", parseError);
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
	const agentRuns = createAgentRunHelpers(send);

	onProgress("Connecting to database...");
	const db = await getDB();
	if (!db) {
		throw new Error("D1 database not available");
	}
	const queries = new DBQueries(db);
	const log = createIngestLogger("ingest-pipeline", db);
	const config = await queries.getAllConfig();
	const memory = new MemoryManager(db);
	await memory.ensureStructure().catch((error) => {
		log.error("Memory ensureStructure failed", error, {
			stage: "init",
		});
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
							conclusion: "Search results collected for ingest review.",
							context: "ingest",
						});
					} catch (error) {
						log.error("Failed to save web search memory", error, {
							stage: "web_observer",
							query: input.query,
						});
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
						log.error("Failed to save web fetch memory", error, {
							stage: "web_observer",
							url: output.url,
						});
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

	const runExtractionPass = async (
		stageId: string,
		stageLabel: string,
		options?: {
			memoryContext?: string;
		},
	) => {
		const systemPrompt = buildSystemPrompt({
			memoryContext: options?.memoryContext,
			criticalTopics,
			enableWebVerification: Boolean(webTools?.length),
		});
		const userPrompt = buildExtractionUserPrompt(text);
		const run = agentRuns.createRun(stageId, stageLabel);
		let rawText = "";
		let emittedResult = false;

		agentRuns.lifecycle(run, "pending", {
			systemPrompt,
			userPrompt,
		});
		agentRuns.lifecycle(run, "running");

			try {
				const result = await generateJsonStream<ExamIngestResponse>(
					payload.config,
					userPrompt,
					examIngestResponseSchema,
					{
						system: systemPrompt,
						tools: webTools,
						onChunk: (
							chunk:
								| StreamChunk
								| StructuredOutputCompleteEvent<ExamIngestResponse>,
						) => {
							if (isTextChunk(chunk) && chunk.delta) {
								rawText += chunk.delta;
								send("chunk", {
									stageId: run.stageId,
									agentRunId: run.agentRunId,
									text: chunk.delta,
								});
							}
							if ("usage" in chunk && chunk.usage) {
								send("token", {
									stageId: run.stageId,
									agentRunId: run.agentRunId,
									usage: chunk.usage,
								});
								agentRuns.token(run, chunk.usage);
							}
							if (
								chunk.type === "CUSTOM" &&
								chunk.name === "structured-output.complete"
							) {
								emittedResult = true;
								agentRuns.result(run, chunk.value.object, rawText);
							}
						},
						onError: (info) => {
							log.error("AI generation error in extraction pass", info.error, {
								stage: stageId,
								agentRunId: run.agentRunId,
								label: stageLabel,
								provider: info.provider,
								model: info.model,
								rawOutputLength: info.rawOutput?.length ?? 0,
								rawOutputPreview: info.rawOutput
									? info.rawOutput.length > 2000
										? `${info.rawOutput.slice(0, 2000)}...`
										: info.rawOutput
									: "(no output)",
							});
						},
					},
				);
				if (!emittedResult) {
					agentRuns.result(run, result, rawText);
				}
				agentRuns.lifecycle(run, "done", {
					meta: {
						questionCount: result.questions.length,
						topicCount: result.topics.length,
					},
				});
				return result;
			}
		} catch (error) {
			log.error("AI extraction pass failed", error, {
				stage: stageId,
				agentRunId: run.agentRunId,
				label: stageLabel,
				rawTextLength: rawText.length,
				rawTextPreview:
					rawText.length > 1000
						? `${rawText.slice(0, 1000)}...`
						: rawText,
				systemPrompt,
				userPromptPreview: userPrompt.length > 500
					? `${userPrompt.slice(0, 500)}...`
					: userPrompt,
			});
			agentRuns.lifecycle(run, "error", {
				error: error instanceof Error ? error.message : "unknown error",
				rawText,
			});
			throw error;
		}
	};

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
		extracted = await runExtractionPass(
			"initial_extraction",
			"Initial extraction agent",
		);
	} catch (err) {
		log.error("Initial extraction failed", err, {
			stage: "initial_extraction",
			textLength: text.length,
			textPreview: text.length > 500 ? `${text.slice(0, 500)}...` : text,
		});
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
	).catch((error) => {
		log.warn("Failed to get memory context", {
			stage: "memory_context",
			topics: extracted.topics,
			error: error instanceof Error ? error.message : "unknown",
		});
		return "";
	});
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
			finalExtracted = await runExtractionPass(
				"memory_refinement",
				"Memory refinement agent",
				{
					memoryContext,
				},
			);
		} catch (err) {
			log.error("Memory refinement failed", err, {
				stage: "memory_refinement",
				questionCount: finalExtracted.questions.length,
				topics: finalExtracted.topics,
			});
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
		onProgress("Running review...");
		sendStage(send, "review", "Review", "running");
		let reviewResult: {
			extracted: ExamIngestResponse;
			reviewed: boolean;
			reviewedQuestionCount: number;
			failedQuestionCount: number;
			reasons: string[];
		};
		try {
			reviewResult = await reviewExtraction(
				payload.config,
				text,
				finalExtracted,
				{
					reviewTopics: criticalTopics,
					tools: webTools,
					onEvent: (event) => {
						if (event.type === "warning") {
							send("warning", { message: event.message });
							return;
						}
						onProgress(event.message);
					},
					onAgentEvent: (event) => {
						send("agent", {
							...event,
							timestamp: Date.now(),
						});
					},
					createAgentRunId: (label) =>
						agentRuns.createRun("review", label).agentRunId,
				},
			);
		} catch (err) {
			log.error("Review failed", err, {
				stage: "review",
				questionCount: finalExtracted.questions.length,
				criticalTopics,
			});
			sendStage(send, "review", "Review", "error", {
				error: err instanceof Error ? err.message : "unknown",
			});
			throw err;
		}
		sendStage(send, "review", "Review", "done", {
			reviewed: reviewResult.reviewed,
			reviewedQuestionCount: reviewResult.reviewedQuestionCount,
			failedQuestionCount: reviewResult.failedQuestionCount,
		});
		finalExtracted = reviewResult.extracted;
		if (reviewResult.reviewed) {
			onProgress("Review completed");
		} else {
			onProgress("Review skipped");
		}
		assertNotAborted();
	} else {
		onProgress("Review disabled for this ingest.");
		sendStage(send, "review", "Review", "skipped", { disabled: true });
		const skippedRun = agentRuns.createRun("review", "Review disabled");
		agentRuns.lifecycle(skippedRun, "skipped", {
			meta: { disabled: true },
		});
		agentRuns.warning(skippedRun, "Review disabled for this ingest.", {
			disabled: true,
		});
	}

	onProgress("Saving to database...");
	sendStage(send, "persist", "Saving to database", "running");

	let examId: number;
	try {
		examId = await queries.insertExam(payload.fileName, "upload");
	} catch (err) {
		log.error("Failed to insert exam", err, {
			stage: "persist",
			fileName: payload.fileName,
			questionCount: finalExtracted.questions.length,
		});
		sendStage(send, "persist", "Saving to database", "error", {
			error: err instanceof Error ? err.message : "unknown",
		});
		throw err;
	}

	if (finalExtracted.questions.length > 0) {
		try {
			await queries.insertQuestions(examId, finalExtracted.questions);
		} catch (err) {
			log.error("Failed to insert questions", err, {
				stage: "persist",
				examId,
				questionCount: finalExtracted.questions.length,
			});
			sendStage(send, "persist", "Saving to database", "error", {
				error: err instanceof Error ? err.message : "unknown",
			});
			throw err;
		}
	}

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
		log.error("Failed to save file", err, {
			stage: "persist",
			examId,
			fileName: payload.fileName,
			mimeType,
			bufferSize: payload.buffer.length,
		});
		sendStage(send, "persist", "Saving to database", "error", {
			error: err instanceof Error ? err.message : "unknown",
		});
		throw err;
	}

	sendStage(send, "persist", "Saving to database", "done");

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
								console.error(
									`[${new Date().toISOString()} ERROR ingest-handler] Ingest job failed:`,
									error,
									`fileName=${parsed.data.fileName}`,
								);
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
