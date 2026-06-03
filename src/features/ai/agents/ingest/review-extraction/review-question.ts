import { generateJson } from "@/features/ai/core/generate";
import type { ProviderConfig, Question } from "@/lib/validation";
import { ingestQuestionSchema } from "@/lib/validation";
import { emitAgentEvent } from "./execute-helpers";
import { buildReviewerSystemPrompt, buildReviewerUserPrompt } from "./prompt";
import type { ReviewExtractionOptions } from "./types";

const reviewerQuestionSchema = ingestQuestionSchema;

export async function reviewSingleQuestion(
	config: ProviderConfig,
	sourceText: string,
	question: Question,
	index: number,
	totalQuestions: number,
	options: ReviewExtractionOptions,
): Promise<
	| { question: Question; success: true }
	| { question: Question; success: false; reason: string }
> {
	const label = `Reviewer Q${index + 1}`;
	const agentRunId =
		options.createAgentRunId?.(label) ?? `review-question-${index + 1}`;
	const systemPrompt = buildReviewerSystemPrompt(options.reviewTopics);
	const userPrompt = buildReviewerUserPrompt(sourceText, question, index);

	emitAgentEvent(options, {
		eventType: "lifecycle",
		stageId: "review",
		agentRunId,
		label,
		status: "pending",
		systemPrompt,
		userPrompt,
		meta: {
			questionIndex: index,
			questionNumber: index + 1,
			topic: question.topic ?? "General",
		},
	});
	emitAgentEvent(options, {
		eventType: "lifecycle",
		stageId: "review",
		agentRunId,
		label,
		status: "running",
		meta: { questionIndex: index, questionNumber: index + 1 },
	});

	try {
		const reviewedQuestion = await generateJson<Question>(
			config,
			userPrompt,
			reviewerQuestionSchema,
			{ system: systemPrompt, tools: options.tools },
		);

		emitAgentEvent(options, {
			eventType: "result",
			stageId: "review",
			agentRunId,
			label,
			finalObject: reviewedQuestion,
			rawText: JSON.stringify(reviewedQuestion),
			meta: { questionIndex: index, questionNumber: index + 1 },
		});
		emitAgentEvent(options, {
			eventType: "lifecycle",
			stageId: "review",
			agentRunId,
			label,
			status: "done",
			meta: { questionIndex: index, questionNumber: index + 1 },
		});

		return { question: reviewedQuestion, success: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		console.error(
			`[${new Date().toISOString()} ERROR review-extraction] ` +
				`Review Q${index + 1}/${totalQuestions} failed: ${message}`,
			`question="${question.question.slice(0, 120)}..."`,
			`topic=${question.topic ?? "General"}`,
		);

		emitAgentEvent(options, {
			eventType: "lifecycle",
			stageId: "review",
			agentRunId,
			label,
			status: "error",
			error: message,
			meta: { questionIndex: index, questionNumber: index + 1 },
		});
		emitAgentEvent(options, {
			eventType: "warning",
			stageId: "review",
			agentRunId,
			label,
			warning: `Review failed for question #${index + 1}. Keeping the original extracted question.`,
			meta: { questionIndex: index, questionNumber: index + 1 },
		});

		return { question, success: false, reason: message };
	}
}
