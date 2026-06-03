import { z } from "zod";
import type { ExamIngestResponse } from "@/lib/validation";
import { providerConfigSchema } from "@/lib/validation";
import { DBQueries } from "../../../db/queries";
import { FileService } from "../../../lib/file-service";
import { createIngestLogger } from "../../../lib/logger";
import { extractTextFromBytes } from "./extract-text";
import { runExtractionPass } from "./extraction-pass";
import { setupMemory } from "./memory-refinement";
import { persistResults } from "./persist";
import { runReviewStage } from "./review-stage";
import { createAgentRunHelpers, sendStage } from "./sse-emitter";

export const ingestRequestSchema = z.object({
	buffer: z.array(z.number()),
	fileName: z.string(),
	config: providerConfigSchema,
	enableReview: z.boolean().optional().default(true),
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

	const { criticalTopics } = await setupMemory({
		db,
		queries,
		providerConfig: payload.config,
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
			config: payload.config,
			criticalTopics,
			agentRuns,
			send,
			log,
			stageId: "initial_extraction",
			stageLabel: "Initial extraction agent",
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
		config: payload.config,
		text,
		extracted: finalExtracted,
		criticalTopics,
		agentRuns,
		send,
		log,
	});
	assertNotAborted();

	if (reviewResult) finalExtracted = reviewResult.extracted;

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
