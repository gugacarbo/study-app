import { z } from "zod";

const optionKeySchema = z
	.string()
	.trim()
	.length(1)
	.regex(/^[A-Z]$/);

const optionSchema = z.object({
	key: optionKeySchema,
	text: z.string().trim().min(1),
});

export const extractedQuestionSchema = z
	.object({
		question: z.string().trim().min(1),
		options: z.array(optionSchema).min(2),
		answers: z.array(z.string()).min(1),
		topic: z.string().trim().min(1),
	})
	.superRefine((data, ctx) => {
		const keys = new Set<string>();
		for (const option of data.options) {
			if (keys.has(option.key)) {
				ctx.addIssue({
					code: "custom",
					message: "duplicate option key",
					path: ["options"],
				});
				return;
			}
			keys.add(option.key);
		}

		for (let i = 0; i < data.answers.length; i++) {
			const answerKey = data.answers[i]?.trim();
			if (!answerKey || !keys.has(answerKey)) {
				ctx.addIssue({
					code: "custom",
					message: "answer key not found in options",
					path: ["answers", i],
				});
			}
		}
	});

export const extractedQuestionsRootSchema = z.object({
	questions: z.array(extractedQuestionSchema),
});

export type ExtractedQuestion = z.infer<typeof extractedQuestionSchema>;
export type ExtractedQuestionsRoot = z.infer<typeof extractedQuestionsRootSchema>;

export type ScoringMode = "exact" | "partial";

export function deriveScoringMode(answers: string[]): ScoringMode {
	return answers.length === 1 ? "exact" : "partial";
}

export function parseExtractedQuestion(
	value: unknown,
): { ok: true; data: ExtractedQuestion } | { ok: false } {
	const result = extractedQuestionSchema.safeParse(value);
	if (!result.success) {
		return { ok: false };
	}
	return { ok: true, data: result.data };
}

export function parseExtractedQuestionsRoot(
	value: unknown,
): { ok: true; data: ExtractedQuestionsRoot } | { ok: false } {
	const result = extractedQuestionsRootSchema.safeParse(value);
	if (!result.success) {
		return { ok: false };
	}
	return { ok: true, data: result.data };
}
