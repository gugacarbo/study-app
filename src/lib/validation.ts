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

function readNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : undefined;
}

function readStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];

	return value
		.filter((entry): entry is string => typeof entry === "string")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

export interface DiscardedIngestQuestion {
	index: number;
	reason: "non-object" | "missing-question" | "missing-answer";
	questionPreview?: string;
}

interface NormalizeExamIngestQuestionResult {
	question: Record<string, unknown> | null;
	discarded?: Omit<DiscardedIngestQuestion, "index">;
}

function normalizeExamIngestQuestion(
	input: unknown,
): NormalizeExamIngestQuestionResult {
	if (typeof input !== "object" || input === null) {
		return {
			question: null,
			discarded: { reason: "non-object" },
		};
	}

	const question = readNonEmptyString(
		"question" in input ? input.question : undefined,
	);
	if (!question) {
		return {
			question: null,
			discarded: { reason: "missing-question" },
		};
	}

	const options = readStringArray(
		"options" in input ? input.options : undefined,
	);
	const answer = readNonEmptyString(
		"answer" in input ? input.answer : undefined,
	);

	if (!answer) {
		return {
			question: null,
			discarded: {
				reason: "missing-answer",
				questionPreview: question.slice(0, 120),
			},
		};
	}

	return {
		question: {
			question,
			options: normalizeIngestOptions(options, answer),
			answer,
			explanation:
				readNonEmptyString(
					"explanation" in input ? input.explanation : undefined,
				) ?? "",
			deepExplanation: readNonEmptyString(
				"deepExplanation" in input ? input.deepExplanation : undefined,
			),
			topic:
				readNonEmptyString("topic" in input ? input.topic : undefined) ??
				"General",
		},
	};
}

export function normalizeExamIngestResponseWithDiagnostics(input: unknown): {
	value: Record<string, unknown> | unknown;
	discardedQuestions: DiscardedIngestQuestion[];
} {
	if (typeof input !== "object" || input === null) {
		return { value: input, discardedQuestions: [] };
	}

	type WithQuestionsAndTopics = {
		questions?: unknown;
		topics?: unknown;
		[key: string]: unknown;
	};
	const typedInput = input as WithQuestionsAndTopics;
	const discardedQuestions: DiscardedIngestQuestion[] = [];
	const normalizedQuestions = Array.isArray(typedInput.questions)
		? typedInput.questions.reduce<Record<string, unknown>[]>(
			(acc, question, index) => {
				const normalized = normalizeExamIngestQuestion(question);
				if (normalized.question) {
					acc.push(normalized.question);
				} else if (normalized.discarded) {
					discardedQuestions.push({
						index,
						...normalized.discarded,
					});
				}
				return acc;
			},
			[],
		)
		: typedInput.questions;
	const shouldKeepOriginalQuestions =
		Array.isArray(typedInput.questions) &&
		typedInput.questions.length > 0 &&
		Array.isArray(normalizedQuestions) &&
		normalizedQuestions.length === 0;

	const normalizedTopics = Array.isArray(typedInput.topics)
		? Array.from(
			new Set(
				typedInput.topics
					.filter((topic): topic is string => typeof topic === "string")
					.map((topic) => topic.trim())
					.filter(Boolean),
			),
		)
		: typedInput.topics;

	return {
		value: {
			...typedInput,
			questions: shouldKeepOriginalQuestions
				? typedInput.questions
				: normalizedQuestions,
			topics: normalizedTopics,
		},
		discardedQuestions,
	};
}

function normalizeExamIngestResponse(
	input: unknown,
): Record<string, unknown> | unknown {
	const result = normalizeExamIngestResponseWithDiagnostics(input);
	if (result.discardedQuestions.length > 0) {
		console.warn(
			"Discarded malformed ingest questions during normalization:",
			JSON.stringify(result.discardedQuestions),
		);
	}
	return result.value;
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

export const examIngestResponseSchema = z.preprocess(
	normalizeExamIngestResponse,
	z.object({
		questions: z.array(ingestQuestionSchema),
		topics: z.array(z.string()),
	}),
);

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
