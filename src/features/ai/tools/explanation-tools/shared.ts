import { z } from "zod";

export const EXPLANATION_TOOL_ERROR_CODE = "EXPLANATION_TOOL_ERROR";
export const QUESTION_NOT_FOUND_ERROR_CODE = "QUESTION_NOT_FOUND";

const nonEmptyTrimmedStringSchema = z.string().trim().min(1);

export const explanationQuestionIdSchema = z.number().int().positive();

export const explanationPatchSchema = z.object({
	questionId: explanationQuestionIdSchema,
	explanation: nonEmptyTrimmedStringSchema,
	deepExplanation: nonEmptyTrimmedStringSchema,
});

export const explanationToolErrorSchema = z.object({
	code: z.string(),
	message: z.string(),
});

export const explanationToolFailureSchema = z.object({
	ok: z.literal(false),
	error: explanationToolErrorSchema,
});
