import { runQuestionExplanations } from "@/features/ai/agents/explanations";
import { bridgeAgentRunEvent } from "@/features/ai/core/bridge-agent-run-event";
import {
	writeStage,
	type AgentRunDescriptor,
	type JobUIMessageStreamWriter,
} from "@/features/ai/core/ui-message-job-stream";
import type { AgentRunStatus } from "@/features/ai/types/ui-message-data-parts";
import type { ExamIngestResponse, ProviderConfig } from "@/lib/validation";
import type { MemoryManager } from "../../../lib/memory";
import { buildTopicMemoryResolver } from "../../../lib/memory/topic-context";

interface AgentRunsHelper {
	allocateAgentRunId(stageId: string): string;
	createRun(stageId: string, label: string): AgentRunDescriptor;
	lifecycle(
		run: AgentRunDescriptor,
		status: AgentRunStatus,
		meta?: Record<string, unknown>,
	): void;
	result(
		run: AgentRunDescriptor,
		finalObject: unknown,
		rawText?: string,
		meta?: Record<string, unknown>,
	): void;
	warning(
		run: AgentRunDescriptor,
		warning: string,
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
	textDelta(run: AgentRunDescriptor, delta: string): void;
	reasoningDelta(run: AgentRunDescriptor, delta: string): void;
}

interface RunExplanationsStageParams {
	enableExplanations: boolean;
	agentConcurrency: number;
	config: ProviderConfig;
	extracted: ExamIngestResponse;
	memory: MemoryManager;
	agentRuns: AgentRunsHelper;
	writer: JobUIMessageStreamWriter;
	onProgress: (step: string) => void;
	onWarning: (message: string, meta?: Record<string, unknown>) => void;
	log: {
		error: (msg: string, err: unknown, ctx?: Record<string, unknown>) => void;
	};
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
		log,
	} = params;

	if (!enableExplanations) {
		onProgress("Explanation generation disabled for this ingest.");
		writeStage(writer, {
			stageId: "explanations",
			label: "Generating explanations",
			status: "skipped",
			timestamp: Date.now(),
			meta: { disabled: true },
		});
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
		return null;
	}

	if (extracted.questions.length === 0) {
		onProgress("No questions to explain.");
		writeStage(writer, {
			stageId: "explanations",
			label: "Generating explanations",
			status: "skipped",
			timestamp: Date.now(),
			meta: { reason: "no_questions" },
		});
		return null;
	}

	onProgress("Generating explanations...");
	writeStage(writer, {
		stageId: "explanations",
		label: "Generating explanations",
		status: "running",
		timestamp: Date.now(),
	});

	try {
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

		const explanationResult = await runQuestionExplanations(
			config,
			explanationInput,
			{
				concurrency: agentConcurrency,
				resolveMemoryContext: (question) =>
					topicMemory.resolveMemoryContext(question.topic),
				onProgress: ({ message }) => onProgress(message),
				onAgentEvent: (event) =>
					bridgeAgentRunEvent(
						event as Parameters<typeof bridgeAgentRunEvent>[0],
						agentRuns,
						(message, meta) => onWarning(message, meta),
					),
				createAgentRunId: (label) => {
					const cached = agentRunIdsByLabel.get(label);
					if (cached) return cached;
					const agentRunId = agentRuns.allocateAgentRunId("explanations");
					agentRunIdsByLabel.set(label, agentRunId);
					return agentRunId;
				},
			},
		);

		const generatedById = new Map(
			explanationResult.questions.map((item) => [item.id, item]),
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

		writeStage(writer, {
			stageId: "explanations",
			label: "Generating explanations",
			status: "done",
			timestamp: Date.now(),
			meta: {
				questionCount: questions.length,
				generatedQuestionCount: explanationResult.generatedQuestionCount,
				failedQuestionCount: explanationResult.failedQuestionCount,
			},
		});
		onProgress("Explanation generation completed");

		return {
			examName: extracted.examName,
			questions,
			topics: extracted.topics,
		};
	} catch (err) {
		log.error("Explanation generation failed", err, {
			stage: "explanations",
			questionCount: extracted.questions.length,
		});
		writeStage(writer, {
			stageId: "explanations",
			label: "Generating explanations",
			status: "error",
			timestamp: Date.now(),
			meta: { error: err instanceof Error ? err.message : "unknown" },
		});
		throw err;
	}
}
