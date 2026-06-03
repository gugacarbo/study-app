import { z } from "zod";

const OPEN_ENDED_INCORRECT_OPTION = "Resposta incorreta.";

function normalizeIngestOptions(options: unknown, answer: string): string[] {
	const normalizedOptions = Array.isArray(options)
		? options
				.filter((option): option is string => typeof option === "string")
				.map((option) => option.trim())
				.filter(Boolean)
		: [];

	const uniqueOptions = Array.from(new Set(normalizedOptions));
	if (uniqueOptions.length >= 2) {
		return uniqueOptions;
	}

	const normalizedAnswer = answer.trim();
	const fallbackOptions = [...uniqueOptions];

	if (
		normalizedAnswer &&
		!fallbackOptions.some((option) => option === normalizedAnswer)
	) {
		fallbackOptions.unshift(normalizedAnswer);
	}

	if (fallbackOptions.length < 2) {
		fallbackOptions.push(OPEN_ENDED_INCORRECT_OPTION);
	}

	if (fallbackOptions[0] === fallbackOptions[1]) {
		fallbackOptions[1] = OPEN_ENDED_INCORRECT_OPTION;
	}

	return fallbackOptions.slice(0, 2);
}

export const questionSchema = z.object({
	question: z.string().min(1, "Question is required"),
	options: z.array(z.string()).min(2, "At least 2 options required"),
	answer: z.string().min(1, "Answer is required"),
	explanation: z.string().nullish().default(""),
	deepExplanation: z.string().nullish(),
	topic: z.string().nullish().default("General"),
});

export type Question = z.infer<typeof questionSchema>;

export const providerConfigSchema = z.object({
	provider: z.enum(["openrouter", "openai", "groq", "ollama", "custom"]),
	model: z.string().min(1, "Model is required"),
	baseUrl: z.string().url().optional(),
	apiKey: z.string(),
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export const ingestQuestionSchema = z.preprocess((input) => {
	if (
		typeof input !== "object" ||
		input === null ||
		!("answer" in input) ||
		typeof input.answer !== "string"
	) {
		return input;
	}

	return {
		...input,
		options: normalizeIngestOptions(
			"options" in input ? input.options : undefined,
			input.answer,
		),
	};
}, questionSchema);

export const examIngestResponseSchema = z.object({
	questions: z.array(ingestQuestionSchema),
	topics: z.array(z.string()),
});

export type ExamIngestResponse = z.infer<typeof examIngestResponseSchema>;

export const attemptSchema = z.object({
	questionId: z.number().int().positive(),
	userAnswer: z.string().min(1),
	correct: z.boolean(),
});

export const memorySessionSchema = z.object({
	examName: z.string(),
	topic: z.string(),
	totalQuestions: z.number().int().positive(),
	correctAnswers: z.number().int().min(0),
	duration: z.number().optional(),
	questions: z.array(
		z.object({
			question: z.string(),
			userAnswer: z.string(),
			correctAnswer: z.string(),
			isCorrect: z.boolean(),
			explanation: z.string(),
			topic: z.string(),
		}),
	),
});
