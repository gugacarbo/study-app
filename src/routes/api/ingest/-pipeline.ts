import { z } from "zod";
import { requireModelConfig } from "@/lib/ai-config";
import type { ExamIngestResponse } from "@/lib/validation";
import {
	createAgentRunWriter,
	writeAgentRun,
	writeJobProgress,
	writeStage,
	type JobUIMessageStreamWriter,
} from "@/features/ai/core/ui-message-job-stream";
import { DBQueries } from "../../../db/queries";
import { FileService } from "../../../lib/file-service";
import { createIngestLogger } from "../../../lib/logger";
import { runExplanationsStage } from "./-explanations-stage";
import { extractTextFromBytes } from "./-extract-text";
import { runExtractionPass } from "./-extraction-pass";
import { setupMemory } from "./-memory-refinement";
import { persistResults } from "./-persist";
import { runReviewStage } from "./-review-stage";

export const ingestRequestSchema = z.object({
	buffer: z.array(z.number()),
	fileName: z.string(),
	enableReview: z.boolean().optional().default(true),
	enableExplanations: z.boolean().optional().default(true),
	agentConcurrency: z.number().int().min(1).max(20).optional().default(10),
});

export type IngestRequest = z.infer<typeof ingestRequestSchema>;

function writeIngestWarning(
	writer: JobUIMessageStreamWriter,
	message: string,
	meta?: Record<string, unknown>,
) {
	writeAgentRun(writer, {
		eventType: "warning",
		stageId: typeof meta?.stageId === "string" ? meta.stageId : "pipeline",
		agentRunId:
			typeof meta?.agentRunId === "string" ? meta.agentRunId : "pipeline",
		label: "Ingest",
		warning: message,
		timestamp: Date.now(),
		meta,
	});
	writeJobProgress(writer, { step: `Warning: ${message}` });
}

export async function runIngestWithProgress(
	payload: IngestRequest,
	writer: JobUIMessageStreamWriter,
	abortSignal: AbortSignal,
) {
	const { getDB } = await import("../../../server-functions/db");
	const { getFilesBucket } = await import("../../../server-functions/storage");
	const assertNotAborted = () => {
		if (abortSignal.aborted) throw new Error("Upload canceled");
	};

	const onProgress = (step: string) => writeJobProgress(writer, { step });
	const onWarning = (message: string, meta?: Record<string, unknown>) =>
		writeIngestWarning(writer, message, meta);
	const agentRuns = createAgentRunWriter(writer);

	onProgress("Connecting to database...");
	const db = await getDB();
	if (!db) throw new Error("D1 database not available");
	const queries = new DBQueries(db);
	const log = createIngestLogger("ingest-pipeline", db);
	const ingestConfig = await requireModelConfig(queries, "ingest");

	onProgress("Preparing memory & tools...");
	writeStage(writer, {
		stageId: "memory_setup",
		label: "Preparing memory & tools",
		status: "running",
		timestamp: Date.now(),
	});

	let memory: Awaited<ReturnType<typeof setupMemory>>["memory"];
	let criticalTopics: string[];
	let reviewerTools: Awaited<ReturnType<typeof setupMemory>>["reviewerTools"];

	try {
		const memorySetup = await setupMemory({
			db,
			queries,
			providerConfig: ingestConfig,
			onProgress,
			onWarning: (message, meta) =>
				onWarning(message, { stageId: "memory_setup", ...meta }),
		});
		memory = memorySetup.memory;
		criticalTopics = memorySetup.criticalTopics;
		reviewerTools = memorySetup.reviewerTools;
		writeStage(writer, {
			stageId: "memory_setup",
			label: "Preparing memory & tools",
			status: "done",
			timestamp: Date.now(),
		});
	} catch (err) {
		log.error("Memory setup failed", err, { stage: "memory_setup" });
		writeStage(writer, {
			stageId: "memory_setup",
			label: "Preparing memory & tools",
			status: "warning",
			timestamp: Date.now(),
			meta: { error: err instanceof Error ? err.message : "unknown" },
		});
		throw err;
	}

	const filesBucket = await getFilesBucket();
	if (!filesBucket) {
		throw new Error("R2 FILES_BUCKET binding is not available");
	}
	const fileService = new FileService(db, filesBucket);
	assertNotAborted();

	onProgress("Decoding file...");
	writeStage(writer, {
		stageId: "decode",
		label: "Decoding file",
		status: "running",
		timestamp: Date.now(),
	});
	const bytes = new Uint8Array(payload.buffer);
	const text = extractTextFromBytes(bytes);
	writeStage(writer, {
		stageId: "decode",
		label: "Decoding file",
		status: "done",
		timestamp: Date.now(),
	});
	assertNotAborted();

	if (!text || text.length < 50) {
		throw new Error(
			"Could not extract enough text from file. Try pasting text manually.",
		);
	}

	onProgress("Extracting questions with AI...");
	writeStage(writer, {
		stageId: "initial_extraction",
		label: "Extracting questions with AI",
		status: "running",
		timestamp: Date.now(),
	});
	let extracted: ExamIngestResponse;
	try {
		extracted = await runExtractionPass({
			text,
			fileName: payload.fileName,
			config: ingestConfig,
			agentRuns,
			onWarning,
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
		writeStage(writer, {
			stageId: "initial_extraction",
			label: "Extracting questions with AI",
			status: "error",
			timestamp: Date.now(),
			meta: { error: err instanceof Error ? err.message : "unknown" },
		});
		throw err;
	}
	writeStage(writer, {
		stageId: "initial_extraction",
		label: "Extracting questions with AI",
		status: "done",
		timestamp: Date.now(),
	});
	onProgress("Initial extraction completed");
	assertNotAborted();

	let finalExtracted: ExamIngestResponse = extracted;

	const reviewConfig = await requireModelConfig(queries, "reviewer");
	const reviewResult = await runReviewStage({
		enableReview: payload.enableReview,
		agentConcurrency: payload.agentConcurrency,
		config: reviewConfig,
		text,
		extracted: finalExtracted,
		criticalTopics,
		tools: reviewerTools,
		agentRuns,
		writer,
		onProgress,
		onWarning,
		log,
	});
	assertNotAborted();

	if (reviewResult) finalExtracted = reviewResult.extracted;

	const explanationsConfig = await requireModelConfig(queries, "explanations");
	const explanationsResult = await runExplanationsStage({
		enableExplanations: payload.enableExplanations,
		agentConcurrency: payload.agentConcurrency,
		config: explanationsConfig,
		extracted: finalExtracted,
		memory,
		agentRuns,
		writer,
		onProgress,
		onWarning,
		log,
	});
	assertNotAborted();

	if (explanationsResult) finalExtracted = explanationsResult;

	onProgress("Saving to database...");
	const { examId, fileId } = await persistResults({
		queries,
		fileService,
		fileName: payload.fileName,
		examName: finalExtracted.examName,
		buffer: payload.buffer,
		questions: finalExtracted.questions,
		writer,
		log,
	});

	onProgress("Completed");
	writeStage(writer, {
		stageId: "complete",
		label: "Ingest complete",
		status: "done",
		timestamp: Date.now(),
	});
	return {
		questions: finalExtracted.questions.length,
		topics: finalExtracted.topics,
		examId,
		fileId,
	};
}
