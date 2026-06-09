import {
	runQuestionExplanations,
	type ExplanationAgentRunEvent,
} from "@/features/ai/agents/explanations";
import type { ExamIngestResponse, ProviderConfig } from "@/lib/validation";
import type { MemoryManager } from "../../../lib/memory";
import type { AgentRunDescriptor, AgentRunStatus } from "./-sse-emitter";
import { sendStage } from "./-sse-emitter";

interface AgentRunsHelper {
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
}

interface RunExplanationsStageParams {
	enableExplanations: boolean;
	config: ProviderConfig;
	extracted: ExamIngestResponse;
	memory: MemoryManager;
	agentRuns: AgentRunsHelper;
	send: (event: string, data: unknown) => void;
	log: {
		error: (msg: string, err: unknown, ctx?: Record<string, unknown>) => void;
	};
}

function bridgeExplanationAgentEvent(
	event: ExplanationAgentRunEvent,
	agentRuns: AgentRunsHelper,
	send: (event: string, data: unknown) => void,
) {
	const run = {
		stageId: event.stageId,
		agentRunId: event.agentRunId,
		label: event.label,
	};
	const meta = event.meta as Record<string, unknown> | undefined;

	if (event.eventType === "lifecycle") {
		agentRuns.lifecycle(run, normalizeAgentStatus(event.status), {
			systemPrompt: event.systemPrompt,
			userPrompt: event.userPrompt,
			rawText: event.rawText,
			finalObject: event.finalObject,
			error: event.error,
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
}

export async function runExplanationsStage(
	params: RunExplanationsStageParams,
): Promise<ExamIngestResponse | null> {
	const {
		enableExplanations,
		config,
		extracted,
		memory,
		agentRuns,
		send,
		log,
	} = params;

	if (!enableExplanations) {
		send("progress", { step: "Explanation generation disabled for this ingest." });
		sendStage(send, "explanations", "Generating explanations", "skipped", {
			disabled: true,
		});
		const skippedRun = agentRuns.createRun(
			"explanations",
			"Explanation generation disabled",
		);
		agentRuns.lifecycle(skippedRun, "skipped", { meta: { disabled: true } });
		return null;
	}

	if (extracted.questions.length === 0) {
		send("progress", { step: "No questions to explain." });
		sendStage(send, "explanations", "Generating explanations", "skipped", {
			reason: "no_questions",
		});
		return null;
	}

	send("progress", { step: "Generating explanations..." });
	sendStage(send, "explanations", "Generating explanations", "running");

	try {
		const topics =
			extracted.topics.length > 0 ? extracted.topics : ["General"];
		const memoryContext = await memory
			.buildMemoryPrompt(topics)
			.catch(() => "");

		const explanationInput = extracted.questions.map((question, index) => ({
			id: index + 1,
			question: question.question,
			options: question.options,
			answer: question.answer,
			topic: question.topic ?? "General",
			explanation: question.explanation ?? "",
		}));

		const explanationResult = await runQuestionExplanations(
			config,
			explanationInput,
			{
				memoryContext: memoryContext || undefined,
				onProgress: ({ message }) => send("progress", { step: message }),
				onAgentEvent: (event) =>
					bridgeExplanationAgentEvent(event, agentRuns, send),
				createAgentRunId: (label) =>
					agentRuns.createRun("explanations", label).agentRunId,
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

		sendStage(send, "explanations", "Generating explanations", "done", {
			questionCount: questions.length,
			generatedQuestionCount: explanationResult.generatedQuestionCount,
			failedQuestionCount: explanationResult.failedQuestionCount,
		});
		send("progress", { step: "Explanation generation completed" });

		return {
			questions,
			topics: extracted.topics,
		};
	} catch (err) {
		log.error("Explanation generation failed", err, {
			stage: "explanations",
			questionCount: extracted.questions.length,
		});
		sendStage(send, "explanations", "Generating explanations", "error", {
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
