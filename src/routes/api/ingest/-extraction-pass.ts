import type { StreamChunk, StructuredOutputCompleteEvent } from "@tanstack/ai";
import { buildSystemPrompt } from "@/features/ai/agents/ingest/system-prompt";
import { generateJsonStream } from "@/features/ai/core/generate";
import type { ExamIngestResponse, ProviderConfig } from "@/lib/validation";
import { examIngestResponseSchema } from "@/lib/validation";
import { buildExtractionUserPrompt } from "./-extract-text";
import type { AgentRunDescriptor, AgentRunStatus } from "./-sse-emitter";
import { isTextChunk } from "./-sse-emitter";

interface ExtractionPassParams {
	text: string;
	config: ProviderConfig;
	criticalTopics: string[];
	agentRuns: {
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
		token(
			run: AgentRunDescriptor,
			tokens: unknown,
			meta?: Record<string, unknown>,
		): void;
	};
	send: (event: string, data: unknown) => void;
	log: {
		error: (msg: string, err: unknown, ctx?: Record<string, unknown>) => void;
	};
	stageId: string;
	stageLabel: string;
}

export async function runExtractionPass(
	params: ExtractionPassParams,
): Promise<ExamIngestResponse> {
	const {
		text,
		config,
		criticalTopics,
		agentRuns,
		send,
		log,
		stageId,
		stageLabel,
	} = params;

	const systemPrompt = buildSystemPrompt({
		criticalTopics,
		enableWebVerification: false,
	});
	const userPrompt = buildExtractionUserPrompt(text);
	const run = agentRuns.createRun(stageId, stageLabel);
	let rawText = "";
	let emittedResult = false;

	agentRuns.lifecycle(run, "pending", { systemPrompt, userPrompt });
	agentRuns.lifecycle(run, "running");

	try {
		const result = await generateJsonStream<ExamIngestResponse>(
			config,
			userPrompt,
			examIngestResponseSchema,
			{
				system: systemPrompt,
				onChunk: (
					chunk:
						| StreamChunk
						| StructuredOutputCompleteEvent<ExamIngestResponse>,
				) => {
					if (isTextChunk(chunk) && chunk.delta) {
						rawText += chunk.delta;
						send("chunk", {
							stageId: run.stageId,
							agentRunId: run.agentRunId,
							text: chunk.delta,
						});
					}
					if ("usage" in chunk && chunk.usage) {
						send("token", {
							stageId: run.stageId,
							agentRunId: run.agentRunId,
							usage: chunk.usage,
						});
						agentRuns.token(run, chunk.usage);
					}
					if (
						chunk.type === "CUSTOM" &&
						chunk.name === "structured-output.complete"
					) {
						emittedResult = true;
						agentRuns.result(run, chunk.value.object, rawText);
					}
				},
				onError: (info) => {
					log.error("AI generation error in extraction pass", info.error, {
						stage: stageId,
						agentRunId: run.agentRunId,
						label: stageLabel,
						provider: info.provider,
						model: info.model,
						rawOutputLength: info.rawOutput?.length ?? 0,
						rawOutputPreview: info.rawOutput
							? info.rawOutput.length > 2000
								? `${info.rawOutput.slice(0, 2000)}...`
								: info.rawOutput
							: "(no output)",
					});
				},
			},
		);
		if (!emittedResult) agentRuns.result(run, result, rawText);
		agentRuns.lifecycle(run, "done", {
			meta: {
				questionCount: result.questions.length,
				topicCount: result.topics.length,
			},
		});
		return result;
	} catch (error) {
		log.error("AI extraction pass failed", error, {
			stage: stageId,
			agentRunId: run.agentRunId,
			label: stageLabel,
			rawTextLength: rawText.length,
			rawTextPreview:
				rawText.length > 1000 ? `${rawText.slice(0, 1000)}...` : rawText,
			systemPrompt,
			userPromptPreview:
				userPrompt.length > 500 ? `${userPrompt.slice(0, 500)}...` : userPrompt,
		});
		agentRuns.lifecycle(run, "error", {
			error: error instanceof Error ? error.message : "unknown error",
			rawText,
		});
		throw error;
	}
}
