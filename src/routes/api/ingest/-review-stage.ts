import { reviewExtraction } from "@/features/ai/agents/ingest/review-extraction";
import type { ExamIngestResponse, ProviderConfig } from "@/lib/validation";
import type { AgentRunDescriptor, AgentRunStatus } from "./-sse-emitter";
import { sendStage } from "./-sse-emitter";

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
		agentConcurrency,
		config,
		text,
		extracted,
		criticalTopics,
		tools,
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
				concurrency: agentConcurrency,
				tools,
				onEvent: (event) => {
					if (event.type === "warning") {
						send("warning", { message: event.message });
						return;
					}
					send("progress", { step: event.message });
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
						send("warning", {
							message: event.warning,
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

function normalizeAgentStatus(status?: string): AgentRunStatus {
	return status === "pending" ||
		status === "running" ||
		status === "done" ||
		status === "error" ||
		status === "skipped"
		? status
		: "running";
}
