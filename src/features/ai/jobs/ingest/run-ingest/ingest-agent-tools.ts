import { tool } from "ai";
import { z } from "zod";
import {
	extractedQuestionSchema,
	type ExtractedQuestion,
} from "@/features/ai/jobs/ingest/extracted-question";
import {
	buildIngestStreamProgressPart,
	buildIngestTextPart,
	serializeIngestDataPart,
	serializeIngestJobEventPart,
} from "@/features/ai/jobs/ingest/ingest-events";
import {
	buildStreamToolResultPart,
	serializeIngestStreamPart,
} from "./ingest-stream-parts";

export const FINISH_EXTRACTION_SUMMARY_MAX_LENGTH = 150;

export const finishExtractionInputSchema = z.object({
	total: z.number().int().nonnegative(),
	summary: z
		.string()
		.trim()
		.min(1)
		.max(FINISH_EXTRACTION_SUMMARY_MAX_LENGTH),
});

export type SubmitQuestionResult =
	| { ok: true; index: number }
	| { ok: false; reason: string };

export type ListQuestionsResult = {
	ok: true;
	total: number;
	questions: ExtractedQuestion[];
};

export type FinishExtractionResult =
	| { ok: false; reason: "questions_not_verified" | "submitted_total_mismatch" }
	| {
			ok: true;
			total: number;
			summary: string;
			verified: true;
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
	let submittedRevision = 0;
	let verifiedRevision = -1;

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
				submittedRevision += 1;
				const index = ctx.questions.length;

				await ctx.append(
					serializeIngestDataPart(buildIngestStreamProgressPart(index)),
				);

				const result: SubmitQuestionResult = { ok: true, index };
				await persistToolResult(toolCallId, result);
				return result;
			},
		}),
		list_questions: tool({
			description:
				"List all extracted questions currently buffered so you can verify nothing was missed before finishing extraction.",
			inputSchema: z.object({}),
			execute: async (_input, { toolCallId }) => {
				verifiedRevision = submittedRevision;
				const result: ListQuestionsResult = {
					ok: true,
					total: ctx.questions.length,
					questions: [...ctx.questions],
				};
				await persistToolResult(toolCallId, result);
				return result;
			},
		}),
		finish_extraction: tool({
			description:
				"Signal that question extraction is complete only after calling list_questions to verify every extracted question. Pass the total submitted and a short summary up to 150 characters.",
			inputSchema: finishExtractionInputSchema,
			execute: async (input, { toolCallId }) => {
				if (verifiedRevision !== submittedRevision) {
					const result: FinishExtractionResult = {
						ok: false,
						reason: "questions_not_verified",
					};
					await persistToolResult(toolCallId, result, true);
					return result;
				}

				if (input.total !== ctx.questions.length) {
					const result: FinishExtractionResult = {
						ok: false,
						reason: "submitted_total_mismatch",
					};
					await persistToolResult(toolCallId, result, true);
					return result;
				}

				ctx.onFinishExtraction();
				const result: FinishExtractionResult = {
					ok: true,
					total: input.total,
					summary: input.summary,
					verified: true,
				};
				await persistToolResult(toolCallId, result);
				await ctx.append(
					serializeIngestJobEventPart(buildIngestTextPart(input.summary)),
				);
				return result;
			},
		}),
	};
}
