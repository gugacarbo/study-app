import { reviewExtraction } from "@/features/ai/agents/ingest/review-extraction";
import type { ExamIngestResponse, ProviderConfig } from "@/lib/validation";
import type { AgentRunDescriptor, AgentRunStatus } from "./-sse-emitter";
import { sendStage } from "./-sse-emitter";

interface RunReviewStageParams {
	enableReview: boolean;
	config: ProviderConfig;
	text: string;
	extracted: ExamIngestResponse;
	criticalTopics: string[];
	tools?: never;
	agentRuns: {
		createRun(stageId: string, label: string): AgentRunDescriptor;
		lifecycle(
			run: AgentRunDescriptor,
			status: AgentRunStatus,
			meta?: Record<string, unknown>,
		): void;
		warning(
			run: AgentRunDescriptor,
			warning: string,
			meta?: Record<string, unknown>,
		): void;
	};
	send: (event: string, data: unknown) => void;
	log: {
		error: (msg: string, err: unknown, ctx?: Record<string, unknown>) => void;
	};
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
		config,
		text,
		extracted,
		criticalTopics,
		agentRuns,
		send,
		log,
	} = params;

	if (!enableReview) {
		send("progress", { step: "Review disabled for this ingest." });
		sendStage(send, "review", "Review", "skipped", { disabled: true });
		const skippedRun = agentRuns.createRun("review", "Review disabled");
		agentRuns.lifecycle(skippedRun, "skipped", {
			meta: { disabled: true },
		});
		agentRuns.warning(skippedRun, "Review disabled for this ingest.", {
			disabled: true,
		});
		return null;
	}

	send("progress", { step: "Running review..." });
	sendStage(send, "review", "Review", "running");

	try {
		const reviewResult = await reviewExtraction(
			// biome-ignore lint/suspicious/noExplicitAny: config shape matches
			config as any,
			text,
			extracted,
			{
				reviewTopics: criticalTopics,
				onEvent: (event) => {
					if (event.type === "warning") {
						send("warning", { message: event.message });
						return;
					}
					send("progress", { step: event.message });
				},
				onAgentEvent: (event) => {
					send("agent", { ...event, timestamp: Date.now() });
				},
				createAgentRunId: (label) =>
					agentRuns.createRun("review", label).agentRunId,
			},
		);

		sendStage(send, "review", "Review", "done", {
			reviewed: reviewResult.reviewed,
			reviewedQuestionCount: reviewResult.reviewedQuestionCount,
			failedQuestionCount: reviewResult.failedQuestionCount,
		});

		const step = reviewResult.reviewed ? "Review completed" : "Review skipped";
		send("progress", { step });

		return {
			extracted: reviewResult.extracted,
			reviewed: reviewResult.reviewed,
			reviewedQuestionCount: reviewResult.reviewedQuestionCount,
			failedQuestionCount: reviewResult.failedQuestionCount,
			reasons: reviewResult.reasons,
		};
	} catch (err) {
		log.error("Review failed", err, {
			stage: "review",
			questionCount: extracted.questions.length,
			criticalTopics,
		});
		sendStage(send, "review", "Review", "error", {
			error: err instanceof Error ? err.message : "unknown",
		});
		throw err;
	}
}
