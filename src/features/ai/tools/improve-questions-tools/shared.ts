import { z } from "zod";

export const IMPROVE_QUESTIONS_TOOL_ERROR_CODE = "IMPROVE_QUESTIONS_TOOL_ERROR";
export const QUESTION_NOT_FOUND_ERROR_CODE = "QUESTION_NOT_FOUND";

export const questionIdSchema = z.number().int().positive();

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

const improveQuestionsOptionsSchema = z
	.array(z.string().trim().min(1))
	.min(5, "At least 5 options required");

const optionalNullableOptionsSchema = z
	.array(z.string().trim().min(1))
	.min(5, "At least 5 options required")
	.nullable()
	.optional()
	.transform((value) => value ?? undefined);

const improveQuestionsAnswersSchema = z
	.array(z.string().trim().min(1))
	.min(1, "At least 1 answer required");

const optionalNullableAnswersSchema = z
	.array(z.string().trim().min(1))
	.min(1, "At least 1 answer required")
	.nullable()
	.optional()
	.transform((value) => value ?? undefined);

const optionalNullableScoringModeSchema = z
	.enum(["exact", "partial"])
	.nullable()
	.optional()
	.transform((value) => value ?? undefined);

function readImproveQuestionsAnswers(input: unknown): string[] {
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

function preprocessImproveQuestionsPatch(input: unknown): unknown {
	if (typeof input !== "object" || input === null) return input;

	const obj = input as Record<string, unknown>;
	if (!("answers" in obj) && !("answer" in obj)) return input;

	if (obj.answers === null && (!("answer" in obj) || obj.answer === null)) {
		return input;
	}

	const answers = readImproveQuestionsAnswers(input);
	if (answers.length === 0) return input;

	const { answer: _answer, ...rest } = obj;
	return { ...rest, answers };
}

export const getQuestionInputSchema = z.object({
	id: questionIdSchema,
});

const optionalNullableQuestionSchema = z
	.string()
	.trim()
	.min(1, "Question stem cannot be empty.")
	.nullable()
	.optional()
	.transform((value) => value ?? undefined);

export const updateQuestionOptionsPatchSchema = z.preprocess(
	preprocessImproveQuestionsPatch,
	z
		.object({
			id: questionIdSchema,
			question: optionalNullableQuestionSchema,
			options: optionalNullableOptionsSchema,
			answers: optionalNullableAnswersSchema,
			answer: optionalNullableTrimmedStringSchema.refine(
				(value) => value === undefined || value.length > 0,
				"Answer cannot be empty.",
			),
			scoringMode: optionalNullableScoringModeSchema,
			explanation: optionalNullableStringSchema,
		})
		.transform(({ answer: _answer, ...data }) => data),
);

export const improveQuestionsToolFailureSchema = z.object({
	ok: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string(),
	}),
});

export type GetQuestionInput = z.output<typeof getQuestionInputSchema>;
export type UpdateQuestionOptionsPatch = z.output<
	typeof updateQuestionOptionsPatchSchema
>;

export { improveQuestionsAnswersSchema, improveQuestionsOptionsSchema };
