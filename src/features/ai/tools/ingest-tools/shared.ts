import { z } from "zod";

export const INGEST_TOOL_ERROR_CODE = "INGEST_TOOL_ERROR";
export const QUESTION_NOT_FOUND_ERROR_CODE = "QUESTION_NOT_FOUND";

export const extractionQuestionIdSchema = z
	.string()
	.regex(/^q\d+$/, "Question ID must look like q1, q2, q3");

const optionalNullableStringSchema = z
	.string()
	.nullable()
	.optional()
	.transform((value) => value ?? undefined);

const optionalNullableTrimmedStringSchema = z
	.string()
	.trim()
	.nullable()
	.optional()
	.transform((value) => value ?? undefined);

const optionalNullableStringArraySchema = z
	.array(z.string())
	.nullable()
	.optional()
	.transform((value) => value ?? undefined);

export const extractionQuestionFieldsSchema = z.object({
	question: z.string().trim().min(1),
	options: z.array(z.string()).default([]),
	answer: z.string().trim().min(1),
	explanation: optionalNullableStringSchema,
	topic: optionalNullableTrimmedStringSchema,
});

export const extractionQuestionPatchSchema = z.object({
	questionId: extractionQuestionIdSchema,
	question: optionalNullableTrimmedStringSchema.refine(
		(value) => value === undefined || value.length > 0,
		"Question cannot be empty.",
	),
	options: optionalNullableStringArraySchema,
	answer: optionalNullableTrimmedStringSchema.refine(
		(value) => value === undefined || value.length > 0,
		"Answer cannot be empty.",
	),
	topic: optionalNullableTrimmedStringSchema,
	explanation: optionalNullableStringSchema,
});

const extractionToolErrorSchema = z.object({
	code: z.string(),
	message: z.string(),
});

export const extractionToolFailureSchema = z.object({
	ok: z.literal(false),
	error: extractionToolErrorSchema,
});
