import { z } from "zod";

export const questionSchema = z.object({
	question: z.string().min(1, "Question is required"),
	options: z.array(z.string()).min(2, "At least 2 options required"),
	answer: z.string().min(1, "Answer is required"),
	explanation: z.string().optional().default(""),
	deepExplanation: z.string().optional(),
	topic: z.string().optional().default("General"),
});

export type Question = z.infer<typeof questionSchema>;

export const attemptSchema = z.object({
	questionId: z.number(),
	userAnswer: z.string(),
	correct: z.boolean(),
});

export type Attempt = z.infer<typeof attemptSchema>;

export const providerConfigSchema = z.object({
	provider: z.enum(["openrouter", "openai", "groq", "ollama", "custom"]),
	model: z.string().min(1, "Model is required"),
	baseUrl: z.string().url().optional(),
	apiKey: z.string(),
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export const examIngestResponseSchema = z.object({
	questions: z.array(questionSchema),
	topics: z.array(z.string()),
});

export type ExamIngestResponse = z.infer<typeof examIngestResponseSchema>;

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

export type MemorySession = z.infer<typeof memorySessionSchema>;
