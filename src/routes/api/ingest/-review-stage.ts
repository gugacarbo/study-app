import type { ToolSet } from "ai";
import { deriveTopics } from "@/features/ai/agents/ingest/review-extraction/prompt";
import { reviewSingleQuestion } from "@/features/ai/agents/ingest/review-extraction/review-question";
import type { IngestReviewAgentEvent } from "@/features/ai/agents/ingest/review-extraction/types";
import { bridgeAgentRunEvent } from "@/features/ai/core/bridge-agent-run-event";
import {
	type AgentRunDescriptor,
	type createAgentRunWriter,
	type JobUIMessageStreamWriter,
	writeStage,
} from "@/features/ai/core/ui-message-job-stream";
import type { PipelineRunContext } from "@/features/ai/pipeline/server/create-job-api-route";
import type { PipelineLogger } from "@/features/ai/pipeline/server/pipeline-logger";
import { runConcurrentBatch } from "@/features/ai/pipeline/server/run-concurrent-batch";
import { runPipelineStage } from "@/features/ai/pipeline/server/run-pipeline-stage";
import type { ExamIngestResponse, ProviderConfig } from "@/lib/validation";

const MAX_REVIEW_ATTEMPTS = 3;

type ReviewStageResult = {
	extracted: ExamIngestResponse;
	reviewed: boolean;
	reviewedQuestionCount: number;
	failedQuestionCount: number;
	reasons: string[];
};

function noopPipelineLogger(): PipelineLogger {
	const noop = () => {};
	return {
		debug: noop,
		info: noop,
		warning: noop,
		error: noop,
		step: noop,
		withContext: () => noopPipelineLogger(),
	};
}

type AgentRunWriter = ReturnType<typeof createAgentRunWriter>;

interface RunReviewStageParams {
	enableReview: boolean;
	agentConcurrency: number;
	config: ProviderConfig;
	text: string;
	extracted: ExamIngestResponse;
	criticalTopics: string[];
	tools?: ToolSet;
	agentRuns: AgentRunWriter;
	writer: JobUIMessageStreamWriter;
	log?: PipelineLogger;
	ctx?: PipelineRunContext;
	onProgress: (step: string) => void;
	onWarning: (message: string, meta?: Record<string, unknown>) => void;
}

export async function runReviewStage(params: RunReviewStageParams): Promise<{
	extracted: ExamIngestResponse;
	reviewed: boolean;
	reviewedQuestionCount: number;
	failedQuestionCount: number;
	reasons: string[];
} | null> {
	const {
		enableReview,
		agentConcurrency,
		config,
		text,
		extracted,
		criticalTopics,
		tools,
		agentRuns,
		writer,
		onProgress,
		onWarning,
		log = noopPipelineLogger(),
		ctx,
	} = params;

	if (!enableReview) {
		onProgress("Review disabled for this ingest.");
		await runPipelineStage(
			writer,
			{ stageId: "review", label: "Review" },
			async () => {
				const skippedRun = agentRuns.createRun("review", "Review disabled");
				agentRuns.lifecycle(skippedRun, "skipped", {
					meta: { disabled: true },
				});
				agentRuns.warning(skippedRun, "Review disabled for this ingest.", {
					disabled: true,
				});
				return "skipped" as const;
			},
			{ log, ctx, meta: { disabled: true } },
		);
		return null;
	}

	const totalQuestions = extracted.questions.length;
	if (totalQuestions === 0) {
		onProgress("No extracted questions were available for review.");
		await runPipelineStage(
			writer,
			{ stageId: "review", label: "Review" },
			async () => "skipped" as const,
			{ log, ctx, meta: { reason: "no_questions" } },
		);
		return null;
	}

	if (Object.keys(tools ?? {}).length === 0) {
		onWarning(
			"Web verification tools are unavailable. Continuing with LLM-only review (no web search/fetch).",
		);
	}

	const agentRunIdsByLabel = new Map<string, string>();
	const runsByIndex = new Map<number, AgentRunDescriptor>();
	let reviewResult: ReviewStageResult | null = null;

	await runPipelineStage(
		writer,
		{ stageId: "review", label: "Review" },
		async () => {
			onProgress("Running review...");
			onProgress(
				`Reviewing ${totalQuestions} extracted question${totalQuestions === 1 ? "" : "s"} in parallel...`,
			);

			const batch = await runConcurrentBatch({
				items: extracted.questions,
				concurrency: agentConcurrency,
				maxAttempts: MAX_REVIEW_ATTEMPTS,
				log,
				agentRuns,
				onProgress,
				onWarning,
				getRunForItem: (_item, index) => runsByIndex.get(index),
				mapper: async (question, index) => {
					const label = `Reviewer Q${index + 1}`;
					const agentRunId = agentRuns.allocateAgentRunId("review");
					agentRunIdsByLabel.set(label, agentRunId);
					runsByIndex.set(index, {
						stageId: "review",
						agentRunId,
						label,
					});

					const result = await reviewSingleQuestion(
						config,
						text,
						question,
						index,
						totalQuestions,
						{
							reviewTopics: criticalTopics,
							tools,
							onEvent: (event) => {
								if (event.type === "warning") {
									onWarning(event.message);
									return;
								}
								onProgress(event.message);
							},
							onAgentEvent: (event) => {
								bridgeAgentRunEvent(
									event as IngestReviewAgentEvent,
									agentRuns,
									(message, meta) => onWarning(message, meta),
								);
							},
							createAgentRunId: () => agentRunId,
						},
					);

					return {
						success: result.success,
						result: result.question,
						error: result.success ? undefined : result.reason,
					};
				},
			});

			const reviewedQuestions = extracted.questions.map((question, index) => {
				const outcome = batch.results[index];
				return outcome?.success && outcome.result ? outcome.result : question;
			});
			const failedQuestionCount = batch.failureCount;
			const reviewedQuestionCount = batch.successCount;
			const reasons = batch.results.flatMap((outcome) =>
				outcome.error ? [outcome.error] : [],
			);

			reviewResult = {
				extracted: {
					examName: extracted.examName,
					questions: reviewedQuestions,
					topics: deriveTopics(reviewedQuestions, extracted.topics),
				},
				reviewed: true,
				reviewedQuestionCount,
				failedQuestionCount,
				reasons,
			};

			onProgress(
				reviewedQuestionCount > 0 ? "Review completed" : "Review skipped",
			);

			return "done" as const;
		},
		{ log, ctx },
	);

	if (reviewResult !== null) {
		const completedReview: ReviewStageResult = reviewResult;
		writeStage(writer, {
			stageId: "review",
			label: "Review",
			status: "done",
			timestamp: Date.now(),
			meta: {
				reviewed: completedReview.reviewed,
				reviewedQuestionCount: completedReview.reviewedQuestionCount,
				failedQuestionCount: completedReview.failedQuestionCount,
			},
		});
	}

	return reviewResult;
}
