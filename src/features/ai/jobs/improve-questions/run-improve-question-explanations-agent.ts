import { stepCountIs, streamText, tool, type ToolSet } from "ai";
import { z } from "zod";
import type { LanguageModel } from "ai";
import type { AppDatabase } from "@/db/client";
import {
	getPendingQuestionImprovementDraftByQuestion,
	updatePendingQuestionImprovementDraftExplanations,
} from "@/db/queries/question-improvement-drafts";
import {
	buildImproveQuestionStageEvent,
	buildImproveQuestionWarningEvent,
	buildImproveTextEvent,
	buildImproveToolCallEvent,
	buildImproveToolResultEvent,
} from "@/features/ai/jobs/improve-questions/improve-question-events";
import { TavilyWebContentProvider } from "@/features/ai/providers/web/tavily-content";
import { TavilyWebSearchProvider } from "@/features/ai/providers/web/tavily-search";
import { createWebTools } from "@/features/ai/tools/web-tools";
import { IMPROVE_QUESTION_STAGE } from "@/lib/job-kinds";

const MAX_AGENT_STEPS = 6;
const MAX_FINISH_RETRIES = 3;
const updateExplanationsSchema = z.object({
	questionId: z.string().uuid(),
	explanation: z.string().trim().min(1).max(10000),
	deepExplanation: z.string().trim().min(1).max(10000),
});
const finishSchema = z.object({
	summary: z.string().trim().min(1).max(400),
	alerts: z.array(z.string().trim().min(1).max(400)).max(10).optional(),
});

function buildPrompt(questionId: string, missingFinishAttempt = 0): string {
	const promptLines = [
		`Rewrite explanations for question ${questionId}.`,
		"Always call list_question first.",
		"Only edit explanation and deepExplanation.",
		"Both explanation fields are required and must never be null or empty.",
		"Call update_explanations before finish_explanations.",
		"Never end a run without calling finish_explanations.",
		"If you find a correctness issue, include it in alerts.",
	];

	if (missingFinishAttempt > 0) {
		promptLines.push(
			"WARNING: You must call finish_explanations before ending this run.",
			`Attempt ${missingFinishAttempt} of ${MAX_FINISH_RETRIES} after missing finish_explanations.`,
			"Do not stop at analysis or plain text. Use the tool to finish the task.",
		);
	}

	return promptLines.join("\n");
}

function buildExplanationStepMessageId(questionId: string, stepNumber: number): string {
	return `explanations:${questionId}:step:${stepNumber}`;
}

export async function runImproveQuestionExplanationsAgent(input: {
	db: AppDatabase;
	jobId: string;
	userId: string;
	examId: string;
	questionId: string;
	model: LanguageModel;
	streamText?: typeof streamText;
	appendJobEvent: (jobId: string, payload: unknown) => Promise<void>;
	webSearchApiKey?: string;
}): Promise<{ summary: string; alerts: string[] }> {
	await input.appendJobEvent(
		input.jobId,
		buildImproveQuestionStageEvent(
			input.questionId,
			IMPROVE_QUESTION_STAGE.WRITING_EXPLANATIONS,
		),
	);

	const initialDraft = await getPendingQuestionImprovementDraftByQuestion(input.db, {
		userId: input.userId,
		examId: input.examId,
		questionId: input.questionId,
		jobId: input.jobId,
	});
	if (!initialDraft) {
		throw new Error("Pending question improvement draft was not found");
	}

	let currentDraft = initialDraft;
	let listed = false;
	let updated = false;
	let finished = false;
	let latestSummary = currentDraft.summary ?? "";
	let latestAlerts: string[] = [];
	let currentMessageId = buildExplanationStepMessageId(input.questionId, 1);

	const tools: ToolSet = {
		list_question: tool({
			description:
				"Load the current improved question draft before rewriting explanations.",
			inputSchema: z.object({
				questionId: z.string().uuid(),
			}),
			execute: async ({ questionId }, context) => {
				if (questionId !== input.questionId) {
					throw new Error("This agent may only read its assigned question");
				}
				listed = true;
				const result = {
					ok: true as const,
					data: {
						questionId: input.questionId,
						...currentDraft.improvedSnapshot,
					},
				};
				if (context?.toolCallId) {
					await input.appendJobEvent(
						input.jobId,
						buildImproveToolResultEvent({
							questionId: input.questionId,
							messageId: currentMessageId,
							toolCallId: context.toolCallId,
							result,
						}),
					);
				}
				return result;
			},
		}),
		update_explanations: tool({
			description:
				"Overwrite only explanation and deepExplanation for the assigned question draft.",
			inputSchema: updateExplanationsSchema,
			execute: async (payload, context) => {
				if (!listed) {
					throw new Error("list_question must be called before update_explanations");
				}
				const parsed = updateExplanationsSchema.parse(payload);
				if (parsed.questionId !== input.questionId) {
					throw new Error("This agent may only update its assigned question");
				}

				currentDraft = await updatePendingQuestionImprovementDraftExplanations(
					input.db,
					{
						userId: input.userId,
						examId: input.examId,
						questionId: input.questionId,
						jobId: input.jobId,
						explanation: parsed.explanation,
						deepExplanation: parsed.deepExplanation,
						summary: currentDraft.summary,
						metadata: currentDraft.metadata,
					},
				);
				updated = true;

				const result = { ok: true as const };
				if (context?.toolCallId) {
					await input.appendJobEvent(
						input.jobId,
						buildImproveToolResultEvent({
							questionId: input.questionId,
							messageId: currentMessageId,
							toolCallId: context.toolCallId,
							result,
						}),
					);
				}
				return result;
			},
		}),
		finish_explanations: tool({
			description:
				"Finish the explanation rewrite with a required summary and optional alerts.",
			inputSchema: finishSchema,
			execute: async (payload, context) => {
				if (!listed || !updated) {
					throw new Error(
						"finish_explanations requires list_question and update_explanations first",
					);
				}
				const parsed = finishSchema.parse(payload);
				latestSummary = parsed.summary;
				latestAlerts = parsed.alerts ?? [];
				const nextMetadata = JSON.stringify({
					...(currentDraft.metadata ? JSON.parse(currentDraft.metadata) : {}),
					explanations: {
						summary: latestSummary,
						alerts: latestAlerts,
					},
				});
				currentDraft = await updatePendingQuestionImprovementDraftExplanations(
					input.db,
					{
						userId: input.userId,
						examId: input.examId,
						questionId: input.questionId,
						jobId: input.jobId,
						explanation: currentDraft.improvedSnapshot.explanation,
						deepExplanation: currentDraft.improvedSnapshot.deepExplanation,
						summary: latestSummary,
						metadata: nextMetadata,
					},
				);
				finished = true;

				for (const alert of latestAlerts) {
					await input.appendJobEvent(
						input.jobId,
						buildImproveQuestionWarningEvent(input.questionId, alert),
					);
				}

				const result = {
					ok: true as const,
					summary: latestSummary,
					alerts: latestAlerts,
				};
				if (context?.toolCallId) {
					await input.appendJobEvent(
						input.jobId,
						buildImproveToolResultEvent({
							questionId: input.questionId,
							messageId: currentMessageId,
							toolCallId: context.toolCallId,
							result,
						}),
					);
				}
				return result;
			},
		}),
	};

	if (input.webSearchApiKey) {
		Object.assign(
			tools,
			createWebTools(
				new TavilyWebSearchProvider({ apiKey: input.webSearchApiKey }),
				new TavilyWebContentProvider({ apiKey: input.webSearchApiKey }),
				{
					onWarning: async (message) => {
						await input.appendJobEvent(
							input.jobId,
							buildImproveQuestionWarningEvent(input.questionId, message),
						);
					},
				},
			),
		);
	}

	const runStreamText = input.streamText ?? streamText;
	for (
		let missingFinishAttempt = 0;
		missingFinishAttempt <= MAX_FINISH_RETRIES && !finished;
		missingFinishAttempt += 1
	) {
		const result = runStreamText({
			model: input.model,
			system:
				"You are a specialist in writing explanations for one multiple-choice exam question at a time. Do not edit the question structure or answers. Every successful run must end by calling finish_explanations.",
			prompt: buildPrompt(input.questionId, missingFinishAttempt),
			tools,
			stopWhen: [stepCountIs(MAX_AGENT_STEPS)],
		});

		for await (const part of result.fullStream) {
			if (part.type === "start-step") {
				const nextStep =
					Number.parseInt(currentMessageId.split(":").at(-1) ?? "1", 10) + 1;
				currentMessageId = buildExplanationStepMessageId(
					input.questionId,
					nextStep,
				);
				continue;
			}
			if (part.type === "text-delta") {
				await input.appendJobEvent(
					input.jobId,
					buildImproveTextEvent(input.questionId, currentMessageId, part.text),
				);
			}
			if (part.type === "tool-call") {
				await input.appendJobEvent(
					input.jobId,
					buildImproveToolCallEvent({
						questionId: input.questionId,
						messageId: currentMessageId,
						toolCallId: part.toolCallId,
						toolName: part.toolName,
						argsText: JSON.stringify(part.input),
					}),
				);
			}
			if (part.type === "error") {
				throw part.error;
			}
		}
	}

	if (!finished) {
		throw new Error(
			"Improve question explanations agent finished without calling finish_explanations",
		);
	}

	return {
		summary: latestSummary,
		alerts: latestAlerts,
	};
}
