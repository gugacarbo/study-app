import { z } from "zod";

export const INGEST_TOOL_ERROR_CODE = "INGEST_TOOL_ERROR";
export const QUESTION_NOT_FOUND_ERROR_CODE = "QUESTION_NOT_FOUND";

export const extractionQuestionIdSchema = z
	.string()
	.regex(/^q\d+$/, "Question ID must look like q1, q2, q3");

export const extractionQuestionFieldsSchema = z.object({
	question: z.string().trim().min(1),
	options: z.array(z.string()).default([]),
	answer: z.string().trim().min(1),
	explanation: z.string().optional(),
	topic: z.string().trim().optional(),
});

export const extractionQuestionPatchSchema = z
	.object({
		questionId: extractionQuestionIdSchema,
		question: z.string().trim().min(1).optional(),
		options: z.array(z.string()).optional(),
		answer: z.string().trim().min(1).optional(),
		topic: z.string().trim().optional(),
		explanation: z.string().optional(),
	})
	.refine(
		(input) =>
			input.question !== undefined ||
			input.options !== undefined ||
			input.answer !== undefined ||
			input.topic !== undefined ||
			input.explanation !== undefined,
		{
			message:
				"Provide at least one field to update: question, options, answer, topic, or explanation.",
		},
	);

export const extractionToolErrorSchema = z.object({
	code: z.string(),
	message: z.string(),
});

export const extractionToolFailureSchema = z.object({
	ok: z.literal(false),
	error: extractionToolErrorSchema,
});
