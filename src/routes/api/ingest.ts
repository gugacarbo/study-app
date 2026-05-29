import type { D1Database } from "@cloudflare/workers-types";
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
  onProgress: (progress: number, step: string) => void,
  abortSignal: AbortSignal,
) {
  const assertNotAborted = () => {
    if (abortSignal.aborted) {
      throw new Error("Upload canceled");
    }
  };

  onProgress(5, "Connecting to database...");
  const db = await getDB();
  if (!db) {
    throw new Error("D1 database not available");
  }
  assertNotAborted();

  const queries = new DBQueries(db);
  const fileService = new FileService(db);

  onProgress(12, "Decoding file...");
  const bytes = new Uint8Array(payload.buffer);
  const text = extractTextFromBytes(bytes);
  assertNotAborted();

  if (!text || text.length < 50) {
    throw new Error(
      "Could not extract enough text from file. Try pasting text manually.",
    );
  }

  onProgress(28, "Extracting questions with AI...");
  const extracted = await extractQuestionsFromText(payload.config, text);
  onProgress(56, "Initial extraction completed");
  assertNotAborted();

  onProgress(60, "Loading study-memory context...");
  const memoryContext = await getMemoryContextForTopics(
    db,
    extracted.topics,
  ).catch(() => "");
  assertNotAborted();

  let finalExtracted = extracted;
  if (memoryContext) {
    onProgress(66, "Refining extraction with memory context...");
    finalExtracted = await extractQuestionsFromText(
      payload.config,
      text,
      memoryContext,
    );
    onProgress(84, "Memory refinement completed");
    assertNotAborted();
  }

  onProgress(88, "Saving exam...");
  const examId = await queries.insertExam(payload.fileName, "upload");

  if (finalExtracted.questions.length > 0) {
    onProgress(92, "Saving extracted questions...");
    await queries.insertQuestions(examId, finalExtracted.questions);
  }

  onProgress(96, "Saving original file...");
  const mimeType = FileService.inferMimeType(payload.fileName);
  const fileId = await fileService.save(
    examId,
    payload.fileName,
    payload.buffer,
    mimeType,
  );

  onProgress(100, "Completed");
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
        let lastProgress = 0;

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const send = (event: string, data: unknown) => {
              controller.enqueue(encoder.encode(formatSSE(event, data)));
            };

            const sendProgress = (progress: number, step: string) => {
              const bounded = Math.max(lastProgress, Math.min(100, progress));
              lastProgress = bounded;
              send("progress", { progress: bounded, step });
            };

            void (async () => {
              try {
                const result = await runIngestWithProgress(
                  parsed.data,
                  sendProgress,
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
