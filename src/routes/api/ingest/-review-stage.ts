import { reviewExtraction } from "@/features/ai/agents/ingest/review-extraction";
import {
	writeStage,
	type AgentRunDescriptor,
	type JobUIMessageStreamWriter,
} from "@/features/ai/core/ui-message-job-stream";
import type { AgentRunStatus } from "@/features/ai/types/ui-message-data-parts";
import type { ExamIngestResponse, ProviderConfig } from "@/lib/validation";

interface RunReviewStageParams {
	enableReview: boolean;
	agentConcurrency: number;
	config: ProviderConfig;
	text: string;
	extracted: ExamIngestResponse;
	criticalTopics: string[];
	tools?: NonNullable<
		Parameters<typeof import("@/features/ai/core/generate").generateJson>[3]
	>["tools"];
	agentRuns: {
		allocateAgentRunId(stageId: string): string;
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
		result(
			run: AgentRunDescriptor,
			finalObject: unknown,
			rawText?: string,
			meta?: Record<string, unknown>,
		): void;
		token(
			run: AgentRunDescriptor,
			tokens: unknown,
			meta?: Record<string, unknown>,
		): void;
		toolCall(
			run: AgentRunDescriptor,
			tool: {
				name?: string;
				arguments?: string;
				input?: unknown;
				output?: unknown;
				state?: string;
			},
			meta?: Record<string, unknown>,
		): void;
		toolResult(
			run: AgentRunDescriptor,
			result: {
				content?: unknown;
				error?: string;
				state?: string;
			},
			meta?: Record<string, unknown>,
		): void;
	};
	writer: JobUIMessageStreamWriter;
	onProgress: (step: string) => void;
	onWarning: (message: string, meta?: Record<string, unknown>) => void;
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
		log,
	} = params;

	if (!enableReview) {
		onProgress("Review disabled for this ingest.");
		writeStage(writer, {
			stageId: "review",
			label: "Review",
			status: "skipped",
			timestamp: Date.now(),
			meta: { disabled: true },
		});
		const skippedRun = agentRuns.createRun("review", "Review disabled");
		agentRuns.lifecycle(skippedRun, "skipped", {
			meta: { disabled: true },
		});
		agentRuns.warning(skippedRun, "Review disabled for this ingest.", {
			disabled: true,
		});
		return null;
	}

	onProgress("Running review...");
	writeStage(writer, {
		stageId: "review",
		label: "Review",
		status: "running",
		timestamp: Date.now(),
	});

	const agentRunIdsByLabel = new Map<string, string>();

	try {
		const reviewResult = await reviewExtraction(
			// biome-ignore lint/suspicious/noExplicitAny: config shape matches
			config as any,
			text,
			extracted,
			{
				reviewTopics: criticalTopics,
				concurrency: agentConcurrency,
				tools,
				onEvent: (event) => {
					if (event.type === "warning") {
						onWarning(event.message);
						return;
					}
					onProgress(event.message);
				},
				onAgentEvent: (event) => {
					const run = {
						stageId: event.stageId,
						agentRunId: event.agentRunId,
						label: event.label,
					};
					const meta = event.meta;

					if (event.eventType === "lifecycle") {
						agentRuns.lifecycle(run, normalizeAgentStatus(event.status), {
							systemPrompt: event.systemPrompt,
							userPrompt: event.userPrompt,
							rawText: event.rawText,
							finalObject: event.finalObject,
							error: event.error,
							warning: event.warning,
							meta,
						});
						return;
					}

					if (event.eventType === "warning" && event.warning) {
						onWarning(event.warning, {
							stageId: event.stageId,
							agentRunId: event.agentRunId,
						});
						agentRuns.warning(run, event.warning, meta);
						return;
					}

					if (event.eventType === "result") {
						agentRuns.result(run, event.finalObject, event.rawText, meta);
						return;
					}

					if (event.eventType === "token" && event.tokens) {
						agentRuns.token(run, event.tokens, meta);
						return;
					}

					if (event.eventType === "tool-call") {
						agentRuns.toolCall(
							run,
							{
								name: event.name,
								arguments: event.arguments,
								input: event.input,
								output: event.output,
								state: event.state,
							},
							meta,
						);
						return;
					}

					if (event.eventType === "tool-result") {
						agentRuns.toolResult(
							run,
							{
								content: event.content,
								error: event.error,
								state: event.state,
							},
							meta,
						);
					}
				},
				createAgentRunId: (label) => {
					const cached = agentRunIdsByLabel.get(label);
					if (cached) return cached;
					const agentRunId = agentRuns.allocateAgentRunId("review");
					agentRunIdsByLabel.set(label, agentRunId);
					return agentRunId;
				},
			},
		);

		writeStage(writer, {
			stageId: "review",
			label: "Review",
			status: "done",
			timestamp: Date.now(),
			meta: {
				reviewed: reviewResult.reviewed,
				reviewedQuestionCount: reviewResult.reviewedQuestionCount,
				failedQuestionCount: reviewResult.failedQuestionCount,
			},
		});

		const step = reviewResult.reviewed ? "Review completed" : "Review skipped";
		onProgress(step);

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
		writeStage(writer, {
			stageId: "review",
			label: "Review",
			status: "error",
			timestamp: Date.now(),
			meta: { error: err instanceof Error ? err.message : "unknown" },
		});
		throw err;
	}
}

function normalizeAgentStatus(status?: string): AgentRunStatus {
	return status === "pending" ||
		status === "running" ||
		status === "done" ||
		status === "error" ||
		status === "skipped"
		? status
		: "running";
}
