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

const optionalNullableScoringModeSchema = z
	.enum(["exact", "partial"])
	.nullable()
	.optional()
	.transform((value) => value ?? undefined);

function stripNullObjectFields(input: unknown): unknown {
	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		return input;
	}

	return Object.fromEntries(
		Object.entries(input).filter(([, value]) => value !== null),
	);
}

function readExtractionAnswers(input: unknown): string[] {
	if (typeof input !== "object" || input === null) return [];

	if ("answers" in input && input.answers !== null) {
		if (!Array.isArray(input.answers)) return [];
		return input.answers
			.filter((entry): entry is string => typeof entry === "string")
			.map((entry) => entry.trim())
			.filter(Boolean);
	}

	if ("answer" in input && typeof input.answer === "string") {
		const legacy = input.answer.trim();
		return legacy ? [legacy] : [];
	}

	return [];
}

function tryParseJsonString(value: string): unknown | undefined {
	const trimmed = value.trim();
	if (trimmed.length === 0) return undefined;
	try {
		return JSON.parse(trimmed);
	} catch {
		return undefined;
	}
}

function normalizeExtractionQuestionInput(input: unknown): unknown {
	if (typeof input !== "object" || input === null) return input;

	const obj = { ...(input as Record<string, unknown>) };
	if (obj.question == null && typeof obj.questionText === "string") {
		obj.question = obj.questionText;
		delete obj.questionText;
	}

	for (const field of ["options", "answers"] as const) {
		if (typeof obj[field] === "string") {
			const parsed = tryParseJsonString(obj[field]);
			if (Array.isArray(parsed)) {
				obj[field] = parsed;
			}
		}
	}

	return obj;
}

function preprocessExtractionQuestionFields(input: unknown): unknown {
	const normalized = normalizeExtractionQuestionInput(
		stripNullObjectFields(input),
	);
	if (typeof normalized !== "object" || normalized === null) return normalized;

	const answers = readExtractionAnswers(normalized);
	if (answers.length === 0) return normalized;

	const { answer: _answer, ...rest } = normalized as Record<string, unknown>;
	return { ...rest, answers };
}

function preprocessExtractionQuestionPatch(input: unknown): unknown {
	if (typeof input !== "object" || input === null) return input;

	const obj = input as Record<string, unknown>;
	if (!("answers" in obj) && !("answer" in obj)) return input;

	if (obj.answers === null && (!("answer" in obj) || obj.answer === null)) {
		return input;
	}

	const answers = readExtractionAnswers(input);
	if (answers.length === 0) return input;

	const { answer: _answer, ...rest } = obj;
	return { ...rest, answers };
}

const extractionAnswersSchema = z
	.array(z.string().trim().min(1))
	.min(1, "At least 1 answer required");

const optionalNullableAnswersSchema = z
	.array(z.string().trim().min(1))
	.min(1, "At least 1 answer required")
	.nullable()
	.optional()
	.transform((value) => value ?? undefined);

export const extractionQuestionFieldsSchema = z.preprocess(
	(input) => preprocessExtractionQuestionFields(stripNullObjectFields(input)),
	z
		.object({
			question: z.string().trim().min(1),
			options: z.array(z.string()).default([]),
			answers: extractionAnswersSchema,
			answer: z.string().trim().min(1).optional(),
			scoringMode: z.enum(["exact", "partial"]).optional(),
			explanation: optionalNullableStringSchema,
			topic: optionalNullableTrimmedStringSchema,
		})
		.transform(({ answer: _answer, ...data }) => data),
);

export const extractionQuestionPatchSchema = z.preprocess(
	(input) => preprocessExtractionQuestionPatch(stripNullObjectFields(input)),
	z
		.object({
			questionId: extractionQuestionIdSchema,
			question: optionalNullableTrimmedStringSchema.refine(
				(value) => value === undefined || value.length > 0,
				"Question cannot be empty.",
			),
			options: optionalNullableStringArraySchema,
			answers: optionalNullableAnswersSchema,
			answer: optionalNullableTrimmedStringSchema.refine(
				(value) => value === undefined || value.length > 0,
				"Answer cannot be empty.",
			),
			scoringMode: optionalNullableScoringModeSchema,
			topic: optionalNullableTrimmedStringSchema,
			explanation: optionalNullableStringSchema,
		})
		.transform(({ answer: _answer, ...data }) => data),
);

const extractionToolErrorSchema = z.object({
	code: z.string(),
	message: z.string(),
});

export const extractionToolFailureSchema = z.object({
	ok: z.literal(false),
	error: extractionToolErrorSchema,
});

export const extractionToolSuccessBaseSchema = z.object({
	ok: z.literal(true),
	message: z.string().min(1),
});

export type ExtractionQuestionFields = z.output<
	typeof extractionQuestionFieldsSchema
>;
export type ExtractionQuestionPatch = z.output<
	typeof extractionQuestionPatchSchema
>;
