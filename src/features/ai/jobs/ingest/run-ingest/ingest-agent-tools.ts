import { tool } from "ai";
import { z } from "zod";
import {
	extractedQuestionSchema,
	type ExtractedQuestion,
} from "@/features/ai/jobs/ingest/extracted-question";
import {
	buildIngestStreamProgressPart,
	serializeIngestDataPart,
} from "@/features/ai/jobs/ingest/ingest-events";
import {
	buildStreamToolResultPart,
	serializeIngestStreamPart,
} from "./ingest-stream-parts";

export type SubmitQuestionResult =
	| { ok: true; index: number }
	| { ok: false; reason: string };

export type FinishExtractionResult = {
	ok: true;
	total: number;
};

export type IngestAgentToolsContext = {
	append: (payload: string) => Promise<void>;
	getCurrentMessageId: () => string;
	questions: ExtractedQuestion[];
	onFinishExtraction: () => void;
};

function formatValidationReason(error: z.ZodError): string {
	const firstIssue = error.issues[0];
	return firstIssue?.message ?? "invalid_question";
}

export function createIngestAgentTools(ctx: IngestAgentToolsContext) {
	const persistToolResult = async (
		toolCallId: string,
		result: unknown,
		isError?: boolean,
	) => {
		await ctx.append(
			serializeIngestStreamPart(
				buildStreamToolResultPart({
					messageId: ctx.getCurrentMessageId(),
					toolCallId,
					result,
					isError,
				}),
			),
		);
	};

	return {
		submit_question: tool({
			description:
				"Submit one extracted multiple-choice question from the exam text.",
			inputSchema: extractedQuestionSchema,
			execute: async (input, { toolCallId }) => {
				const parsed = extractedQuestionSchema.safeParse(input);
				if (!parsed.success) {
					const result: SubmitQuestionResult = {
						ok: false,
						reason: formatValidationReason(parsed.error),
					};
					await persistToolResult(toolCallId, result, true);
					return result;
				}

				ctx.questions.push(parsed.data);
				const index = ctx.questions.length;

				await ctx.append(
					serializeIngestDataPart(buildIngestStreamProgressPart(index)),
				);

				const result: SubmitQuestionResult = { ok: true, index };
				await persistToolResult(toolCallId, result);
				return result;
			},
		}),
		finish_extraction: tool({
			description:
				"Signal that question extraction is complete. Pass the total number of questions submitted.",
			inputSchema: z.object({
				total: z.number().int().nonnegative(),
			}),
			execute: async (input, { toolCallId }) => {
				ctx.onFinishExtraction();
				const result: FinishExtractionResult = {
					ok: true,
					total: input.total,
				};
				await persistToolResult(toolCallId, result);
				return result;
			},
		}),
	};
}
