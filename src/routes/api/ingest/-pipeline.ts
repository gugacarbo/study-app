import { z } from "zod";
import type {
	createAgentRunWriter,
	JobUIMessageStreamWriter,
} from "@/features/ai/core/ui-message-job-stream";
import { writeAgentRun } from "@/features/ai/core/ui-message-job-stream";
import type { PipelineRunContext } from "@/features/ai/pipeline/server/create-job-api-route";
import type { PipelineLogger } from "@/features/ai/pipeline/server/pipeline-logger";
import { runPipelineStage } from "@/features/ai/pipeline/server/run-pipeline-stage";
import { requireModelConfig } from "@/lib/ai-config";
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

export const ingestRequestSchema = z.object({
	buffer: z.array(z.number()),
	fileName: z.string(),
	enableReview: z.boolean().optional().default(true),
	enableExplanations: z.boolean().optional().default(true),
	agentConcurrency: z.number().int().min(1).max(20).optional().default(10),
});

export type IngestRequest = z.infer<typeof ingestRequestSchema>;

interface RunIngestParams {
	payload: IngestRequest;
	writer: JobUIMessageStreamWriter;
	abortSignal: AbortSignal;
	agentRuns: ReturnType<typeof createAgentRunWriter>;
	log: PipelineLogger;
	ctx: PipelineRunContext;
}

function writeIngestWarning(
	writer: JobUIMessageStreamWriter,
	log: PipelineLogger,
	message: string,
	meta?: Record<string, unknown>,
) {
	const stageId = typeof meta?.stageId === "string" ? meta.stageId : "pipeline";
	const agentRunId =
		typeof meta?.agentRunId === "string" ? meta.agentRunId : "pipeline";

	writeAgentRun(writer, {
		eventType: "warning",
		stageId,
		agentRunId,
		label: "Ingest",
		warning: message,
		timestamp: Date.now(),
		meta,
	});
	log.warning(message, meta);
}

export async function runIngestWithProgress({
	payload,
	writer,
	abortSignal,
	agentRuns,
	log,
	ctx,
}: RunIngestParams) {
	const { getDB } = await import("../../../server-functions/db");
	const { getFilesBucket } = await import("../../../server-functions/storage");
	const assertNotAborted = () => {
		if (abortSignal.aborted) throw new Error("Upload canceled");
	};

	const onProgress = (step: string) => log.step(step);
	const onWarning = (message: string, meta?: Record<string, unknown>) =>
		writeIngestWarning(writer, log, message, meta);

	log.step("Connecting to database...");
	const db = await getDB();
	if (!db) throw new Error("D1 database not available");
	const queries = new DBQueries(db);
	const ingestLog = createIngestLogger("ingest-pipeline", db);
	const ingestConfig = await requireModelConfig(queries, "ingest");

	log.step("Preparing memory & tools...");
	const memorySetup = await setupMemory({
		db,
		queries,
		providerConfig: ingestConfig,
		onProgress,
		onWarning: (message, meta) =>
			onWarning(message, { stageId: "memory_setup", ...meta }),
	});

	await runPipelineStage(
		writer,
		{ stageId: "memory_setup", label: "Preparing memory & tools" },
		async () => "done" as const,
		{ log: log.withContext({ stageId: "memory_setup" }), ctx },
	);

	const { memory, criticalTopics, reviewerTools } = memorySetup;

	const filesBucket = await getFilesBucket();
	if (!filesBucket) {
		throw new Error("R2 FILES_BUCKET binding is not available");
	}
	const fileService = new FileService(db, filesBucket);
	assertNotAborted();

	log.step("Decoding file...");
	const bytes = new Uint8Array(payload.buffer);
	let text = "";

	await runPipelineStage(
		writer,
		{ stageId: "decode", label: "Decoding file" },
		async () => {
			text = extractTextFromBytes(bytes);
			return "done" as const;
		},
		{ log: log.withContext({ stageId: "decode" }), ctx },
	);
	assertNotAborted();

	if (!text || text.length < 50) {
		throw new Error(
			"Could not extract enough text from file. Try pasting text manually.",
		);
	}

	log.step("Extracting questions with AI...");
	let extracted!: ExamIngestResponse;

	await runPipelineStage(
		writer,
		{ stageId: "initial_extraction", label: "Extracting questions with AI" },
		async () => {
			const extractionPass = await runExtractionPass({
				text,
				fileName: payload.fileName,
				config: ingestConfig,
				agentRuns,
				onWarning: (message) => onWarning(message),
				log: log.withContext({ stageId: "initial_extraction" }),
				stageId: "initial_extraction",
				stageLabel: "Initial extraction agent",
			});
			extracted = extractionPass.result;
			log.step("Initial extraction completed");
			return extractionPass.stageStatus === "warning"
				? ("warning" as const)
				: ("done" as const);
		},
		{ log: log.withContext({ stageId: "initial_extraction" }), ctx },
	);
	assertNotAborted();

	let finalExtracted = extracted;

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
		log: log.withContext({ stageId: "review" }),
		ctx,
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
		log: log.withContext({ stageId: "explanations" }),
		ctx,
	});
	assertNotAborted();

	if (explanationsResult) finalExtracted = explanationsResult;

	log.step("Saving to database...");
	const { examId, fileId } = await persistResults({
		queries,
		fileService,
		fileName: payload.fileName,
		examName: finalExtracted.examName,
		buffer: payload.buffer,
		questions: finalExtracted.questions,
		writer,
		log: ingestLog,
	});

	log.step("Completed");
	await runPipelineStage(
		writer,
		{ stageId: "complete", label: "Ingest complete" },
		async () => "done" as const,
		{ log, ctx },
	);

	return {
		questions: finalExtracted.questions.length,
		topics: finalExtracted.topics,
		examId,
		fileId,
	};
}
