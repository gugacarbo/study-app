import { z } from "zod";
import { requireProviderConfigFromDb } from "@/lib/ai-config";
import type { ExamIngestResponse } from "@/lib/validation";
import { DBQueries } from "../../../db/queries";
import { FileService } from "../../../lib/file-service";
import { createIngestLogger } from "../../../lib/logger";
import { runExplanationsStage } from "./-explanations-stage";
import { extractTextFromBytes } from "./-extract-text";
import { runExtractionPass } from "./-extraction-pass";
import { setupMemory } from "./-memory-refinement";
import { persistResults } from "./-persist";
import { runReviewStage } from "./-review-stage";
import { createAgentRunHelpers, sendStage } from "./-sse-emitter";

export const ingestRequestSchema = z.object({
	buffer: z.array(z.number()),
	fileName: z.string(),
	enableReview: z.boolean().optional().default(true),
	enableExplanations: z.boolean().optional().default(true),
	agentConcurrency: z.number().int().min(1).max(20).optional().default(10),
});

export type IngestRequest = z.infer<typeof ingestRequestSchema>;

export async function runIngestWithProgress(
	payload: IngestRequest,
	send: (event: string, data: unknown) => void,
	abortSignal: AbortSignal,
) {
	const { getDB } = await import("../../../server-functions/db");
	const { getFilesBucket } = await import("../../../server-functions/storage");
	const assertNotAborted = () => {
		if (abortSignal.aborted) throw new Error("Upload canceled");
	};

	const onProgress = (step: string) => send("progress", { step });
	const agentRuns = createAgentRunHelpers(send);

	onProgress("Connecting to database...");
	const db = await getDB();
	if (!db) throw new Error("D1 database not available");
	const queries = new DBQueries(db);
	const log = createIngestLogger("ingest-pipeline", db);
	const providerConfig = await requireProviderConfigFromDb(queries);

	const { memory, criticalTopics, webTools } = await setupMemory({
		db,
		queries,
		providerConfig,
		send,
	});

	const filesBucket = await getFilesBucket();
	if (!filesBucket) {
		throw new Error("R2 FILES_BUCKET binding is not available");
	}
	const fileService = new FileService(db, filesBucket);
	assertNotAborted();

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
		extracted = await runExtractionPass({
			text,
			config: providerConfig,
			criticalTopics,
			agentRuns,
			send,
			log,
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
			flushStream: () => new Promise((resolve) => setTimeout(resolve, 0)),
		});
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

	let finalExtracted: ExamIngestResponse = extracted;

	const reviewResult = await runReviewStage({
		enableReview: payload.enableReview,
		agentConcurrency: payload.agentConcurrency,
		config: providerConfig,
		text,
		extracted: finalExtracted,
		criticalTopics,
		tools: webTools,
		agentRuns,
		send,
		log,
	});
	assertNotAborted();

	if (reviewResult) finalExtracted = reviewResult.extracted;

	const explanationsResult = await runExplanationsStage({
		enableExplanations: payload.enableExplanations,
		agentConcurrency: payload.agentConcurrency,
		config: providerConfig,
		extracted: finalExtracted,
		memory,
		agentRuns,
		send,
		log,
	});
	assertNotAborted();

	if (explanationsResult) finalExtracted = explanationsResult;

	onProgress("Saving to database...");
	const { examId, fileId } = await persistResults({
		queries,
		fileService,
		fileName: payload.fileName,
		buffer: payload.buffer,
		questions: finalExtracted.questions,
		send,
		log,
	});

	onProgress("Completed");
	sendStage(send, "complete", "Ingest complete", "done");
	return {
		questions: finalExtracted.questions.length,
		topics: finalExtracted.topics,
		examId,
		fileId,
	};
}
