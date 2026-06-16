import { explainSingleQuestion } from "@/features/ai/agents/explanations/generate-explanations/explain-single-question";
import { bridgeAgentRunEvent } from "@/features/ai/core/bridge-agent-run-event";
import {
	writeStage,
	createAgentRunWriter,
	type AgentRunDescriptor,
	type JobUIMessageStreamWriter,
} from "@/features/ai/core/ui-message-job-stream";
import { runConcurrentBatch } from "@/features/ai/pipeline/server/run-concurrent-batch";
import type { PipelineRunContext } from "@/features/ai/pipeline/server/create-job-api-route";
import { runPipelineStage } from "@/features/ai/pipeline/server/run-pipeline-stage";
import type { PipelineLogger } from "@/features/ai/pipeline/server/pipeline-logger";
import type { ExamIngestResponse, ProviderConfig } from "@/lib/validation";
import type { MemoryManager } from "../../../lib/memory";
import { buildTopicMemoryResolver } from "../../../lib/memory/topic-context";

const MAX_EXPLANATION_ATTEMPTS = 3;

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

interface RunExplanationsStageParams {
	enableExplanations: boolean;
	agentConcurrency: number;
	config: ProviderConfig;
	extracted: ExamIngestResponse;
	memory: MemoryManager;
	agentRuns: AgentRunWriter;
	writer: JobUIMessageStreamWriter;
	log?: PipelineLogger;
	ctx?: PipelineRunContext;
	onProgress: (step: string) => void;
	onWarning: (message: string, meta?: Record<string, unknown>) => void;
}

export async function runExplanationsStage(
	params: RunExplanationsStageParams,
): Promise<ExamIngestResponse | null> {
	const {
		enableExplanations,
		agentConcurrency,
		config,
		extracted,
		memory,
		agentRuns,
		writer,
		onProgress,
		onWarning,
		log = noopPipelineLogger(),
		ctx,
	} = params;

	if (!enableExplanations) {
		onProgress("Explanation generation disabled for this ingest.");
		await runPipelineStage(
			writer,
			{ stageId: "explanations", label: "Generating explanations" },
			async () => {
				const skippedRun = agentRuns.createRun(
					"explanations",
					"Explanation generation disabled",
				);
				agentRuns.lifecycle(skippedRun, "skipped", { meta: { disabled: true } });
				agentRuns.warning(
					skippedRun,
					"Explanation generation disabled for this ingest.",
					{ disabled: true },
				);
				return "skipped" as const;
			},
			{ log, ctx, meta: { disabled: true } },
		);
		return null;
	}

	if (extracted.questions.length === 0) {
		onProgress("No questions to explain.");
		await runPipelineStage(
			writer,
			{ stageId: "explanations", label: "Generating explanations" },
			async () => "skipped" as const,
			{ log, ctx, meta: { reason: "no_questions" } },
		);
		return null;
	}

	const explanationInput = extracted.questions.map((question, index) => ({
		id: index + 1,
		question: question.question,
		options: question.options,
		answers: question.answers,
		scoringMode: question.scoringMode,
		topic: question.topic ?? "General",
		explanation: question.explanation ?? "",
	}));

	const topicMemory = await buildTopicMemoryResolver(
		memory,
		explanationInput.map((question) => question.topic ?? "General"),
	);

	const agentRunIdsByLabel = new Map<string, string>();
	const runsByIndex = new Map<number, AgentRunDescriptor>();
	const totalQuestions = explanationInput.length;
	let explanationsResult: ExamIngestResponse | null = null;
	let generatedQuestionCount = 0;
	let failedQuestionCount = 0;

	await runPipelineStage(
		writer,
		{ stageId: "explanations", label: "Generating explanations" },
		async () => {
			onProgress("Generating explanations...");
			onProgress(
				`Generating explanations for ${totalQuestions} question${totalQuestions === 1 ? "" : "s"} in parallel...`,
			);

			const batch = await runConcurrentBatch({
				items: explanationInput,
				concurrency: agentConcurrency,
				maxAttempts: MAX_EXPLANATION_ATTEMPTS,
				log,
				agentRuns,
				onProgress,
				onWarning: (message, meta) => {
					onWarning(message, meta);
				},
				getRunForItem: (_item, index) => runsByIndex.get(index),
				mapper: async (question, index) => {
					const label = `Explanation Q${index + 1}`;
					const agentRunId = agentRuns.allocateAgentRunId("explanations");
					agentRunIdsByLabel.set(label, agentRunId);
					runsByIndex.set(index, {
						stageId: "explanations",
						agentRunId,
						label,
					});

					const result = await explainSingleQuestion(
						config,
						question,
						index,
						totalQuestions,
						{
							concurrency: agentConcurrency,
							resolveMemoryContext: (item) =>
								topicMemory.resolveMemoryContext(item.topic),
							suppressFailureWarning: true,
							onAgentEvent: (event) => {
								bridgeAgentRunEvent(
									event as Parameters<typeof bridgeAgentRunEvent>[0],
									agentRuns,
									(message, meta) => onWarning(message, meta),
								);
							},
							createAgentRunId: () => agentRunId,
						},
					);

					return {
						success: result.success,
						result: result.success ? result.result : undefined,
						error: result.success ? undefined : result.reason,
					};
				},
			});

			generatedQuestionCount = batch.successCount;
			failedQuestionCount = batch.failureCount;

			const generatedById = new Map(
				batch.results.flatMap((outcome) =>
					outcome.success && outcome.result
						? [[outcome.result.id, outcome.result] as const]
						: [],
				),
			);

			const questions = extracted.questions.map((question, index) => {
				const generated = generatedById.get(index + 1);
				if (!generated) return question;

				return {
					...question,
					explanation: generated.explanation.trim(),
					deepExplanation: generated.deepExplanation.trim(),
				};
			});

			explanationsResult = {
				examName: extracted.examName,
				questions,
				topics: extracted.topics,
			};

			onProgress("Explanation generation completed");
			return "done" as const;
		},
		{ log, ctx },
	);

	if (explanationsResult !== null) {
		const completed: ExamIngestResponse = explanationsResult;
		writeStage(writer, {
			stageId: "explanations",
			label: "Generating explanations",
			status: "done",
			timestamp: Date.now(),
			meta: {
				questionCount: completed.questions.length,
				generatedQuestionCount,
				failedQuestionCount,
			},
		});
	}

	return explanationsResult;
}
