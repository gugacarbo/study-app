import { z } from "zod";

const OPEN_ENDED_INCORRECT_OPTION = "Resposta incorreta.";

const scoringModeSchema = z.enum(["exact", "partial"]);

function readAnswers(input: unknown): string[] {
	if (typeof input !== "object" || input === null) return [];

	if ("answers" in input) {
		const fromArray = readStringArray(input.answers);
		if (fromArray.length > 0) return fromArray;
	}

	if ("answer" in input && typeof input.answer === "string") {
		const legacy = input.answer.trim();
		return legacy ? [legacy] : [];
	}

	return [];
}

function normalizeIngestOptions(options: unknown, answers: string[]): string[] {
	const normalizedAnswers = answers
		.map((answer) => answer.trim())
		.filter(Boolean);

	const normalizedOptions = Array.isArray(options)
		? options
				.filter((option): option is string => typeof option === "string")
				.map((option) => option.trim())
				.filter(Boolean)
		: [];

	const uniqueOptions = Array.from(new Set(normalizedOptions));
	if (uniqueOptions.length >= 2) {
		const result = [...uniqueOptions];
		for (const answer of normalizedAnswers) {
			if (!result.some((option) => option === answer)) {
				result.unshift(answer);
			}
		}
		return result;
	}

	const fallbackOptions = [...uniqueOptions];
	for (const answer of normalizedAnswers) {
		if (answer && !fallbackOptions.some((option) => option === answer)) {
			fallbackOptions.unshift(answer);
		}
	}

	if (fallbackOptions.length < 2) {
		fallbackOptions.push(OPEN_ENDED_INCORRECT_OPTION);
	}

	if (
		fallbackOptions.length >= 2 &&
		fallbackOptions[0] === fallbackOptions[1]
	) {
		fallbackOptions[1] = OPEN_ENDED_INCORRECT_OPTION;
	}

	return fallbackOptions.slice(0, Math.max(2, fallbackOptions.length));
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
	const answers = readAnswers(input);

	if (answers.length === 0) {
		return {
			question: null,
			discarded: {
				reason: "missing-answer",
				questionPreview: question.slice(0, 120),
			},
		};
	}

	const scoringMode = readNonEmptyString(
		"scoringMode" in input ? input.scoringMode : undefined,
	);

	return {
		question: {
			question,
			options: normalizeIngestOptions(options, answers),
			answers,
			scoringMode:
				scoringMode === "partial" || scoringMode === "exact"
					? scoringMode
					: "exact",
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

function preprocessLegacyQuestionInput(input: unknown): unknown {
	if (typeof input !== "object" || input === null) return input;

	const answers = readAnswers(input);
	if (answers.length === 0) return input;

	const { answer: _answer, ...rest } = input as Record<string, unknown>;
	return {
		...rest,
		answers,
	};
}

export const questionSchema = z.preprocess(
	preprocessLegacyQuestionInput,
	z.object({
		question: z.string().min(1, "Question is required"),
		options: z.array(z.string()).min(2, "At least 2 options required"),
		answers: z.array(z.string()).min(1, "At least 1 answer required"),
		scoringMode: scoringModeSchema.default("exact"),
		explanation: z.string().nullish().default(""),
		deepExplanation: z.string().nullish(),
		topic: z.string().nullish().default("General"),
	}),
);

export type Question = z.infer<typeof questionSchema>;

export const AI_AGENT_TASKS = [
	"chat",
	"ingest",
	"reviewer",
	"improve_questions",
	"quiz",
	"explanations",
] as const;

export type AiAgentTask = (typeof AI_AGENT_TASKS)[number];

export const THINKING_EFFORT_LEVELS = [
	"minimal",
	"low",
	"medium",
	"high",
] as const;

export type ThinkingEffortLevel = (typeof THINKING_EFFORT_LEVELS)[number];

export const thinkingEffortLevelSchema = z.enum(THINKING_EFFORT_LEVELS);

const thinkingEffortLevelsSchema = z.array(thinkingEffortLevelSchema);

export type RequestParamValue =
	| string
	| number
	| boolean
	| null
	| RequestParamValue[]
	| { [key: string]: RequestParamValue };

const requestParamValueSchema: z.ZodType<RequestParamValue> = z.lazy(() =>
	z.union([
		z.string(),
		z.number(),
		z.boolean(),
		z.null(),
		z.array(requestParamValueSchema),
		z.record(z.string(), requestParamValueSchema),
	]),
);

export const requestParamsSchema = z.record(
	z.string(),
	requestParamValueSchema,
);

export type RequestParams = z.infer<typeof requestParamsSchema>;

export function coerceRequestParamValue(
	value: RequestParamValue,
): RequestParamValue {
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (/^true$/i.test(trimmed)) return true;
		if (/^false$/i.test(trimmed)) return false;
		if (/^null$/i.test(trimmed)) return null;
		if (/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) {
			const parsed = Number(trimmed);
			if (Number.isFinite(parsed)) return parsed;
		}
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((item) => coerceRequestParamValue(item));
	}

	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				coerceRequestParamValue(item),
			]),
		);
	}

	return value;
}

export function coerceRequestParams(params: RequestParams): RequestParams {
	return Object.fromEntries(
		Object.entries(params).map(([key, value]) => [
			key,
			coerceRequestParamValue(value),
		]),
	);
}

const coercedRequestParamsFieldSchema = requestParamsSchema
	.optional()
	.transform((params) => (params ? coerceRequestParams(params) : params));

function refineThinkingEffortDefault<
	T extends {
		thinkingEffortLevels?: ThinkingEffortLevel[];
		defaultThinkingEffort?: ThinkingEffortLevel | null;
		thinkingEnabled?: boolean | null;
	},
>(data: T, ctx: z.RefinementCtx): void {
	const levels = data.thinkingEffortLevels ?? [];
	if (
		data.defaultThinkingEffort &&
		!levels.includes(data.defaultThinkingEffort)
	) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "Default must be one of the selected effort levels",
			path: ["defaultThinkingEffort"],
		});
	}

	if (
		levels.length > 0 &&
		data.thinkingEnabled !== null &&
		data.thinkingEnabled !== undefined
	) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message:
				"Choose either thinking effort levels or boolean thinking, not both",
			path: ["thinkingEnabled"],
		});
	}
}

export const providerConfigSchema = z.object({
	model: z.string().min(1, "Model is required"),
	baseUrl: z.string().url("Base URL must be a valid URL"),
	apiKey: z.string(),
	thinkingEffort: thinkingEffortLevelSchema.nullable().optional(),
	thinkingEnabled: z.boolean().nullable().optional(),
	thinkingParamName: z.string().nullable().optional(),
	requestParams: requestParamsSchema.optional(),
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

const resolvedModelConfigSchema = providerConfigSchema
	.omit({ thinkingEffort: true })
	.extend({
		modelId: z.number().int().positive(),
		providerName: z.string(),
		contextWindow: z.number().int().positive().nullable().optional(),
		inputCostPerMillion: z.number().nonnegative().nullable().optional(),
		outputCostPerMillion: z.number().nonnegative().nullable().optional(),
		thinkingEffortLevels: thinkingEffortLevelsSchema.default([]),
		defaultThinkingEffort: thinkingEffortLevelSchema.nullable().optional(),
		thinkingEnabled: z.boolean().nullable().optional(),
		thinkingParamName: z.string().nullable().optional(),
		requestParams: requestParamsSchema.default({}),
	});

export type ResolvedModelConfig = z.infer<typeof resolvedModelConfigSchema>;

export const createAiProviderSchema = z.object({
	name: z.string().min(1, "Name is required"),
	baseUrl: z.string().url("Base URL must be a valid URL"),
	apiKey: z.string().min(1, "API key is required"),
	enabled: z.boolean().optional(),
});

export const updateAiProviderSchema = z.object({
	id: z.number().int().positive(),
	name: z.string().min(1).optional(),
	baseUrl: z.string().url().optional(),
	apiKey: z.string().optional(),
	enabled: z.boolean().optional(),
});

export const createAiModelSchema = z
	.object({
		providerId: z.number().int().positive(),
		modelId: z.string().min(1, "Model ID is required"),
		displayName: z.string().min(1, "Display name is required"),
		contextWindow: z.number().int().positive().nullable().optional(),
		maxOutputTokens: z.number().int().positive().nullable().optional(),
		inputCostPerMillion: z.number().nonnegative().nullable().optional(),
		outputCostPerMillion: z.number().nonnegative().nullable().optional(),
		thinkingEffortLevels: thinkingEffortLevelsSchema.optional(),
		defaultThinkingEffort: thinkingEffortLevelSchema.nullable().optional(),
		thinkingEnabled: z.boolean().nullable().optional(),
		thinkingParamName: z.string().nullable().optional(),
		enabled: z.boolean().optional(),
		metadata: z.string().nullable().optional(),
		requestParams: coercedRequestParamsFieldSchema,
	})
	.superRefine(refineThinkingEffortDefault);

const llmLogStatusSchema = z.enum([
	"pending",
	"success",
	"failed",
	"cancelled",
]);

export const listLlmLogsSchema = z.object({
	page: z.coerce.number().int().positive().optional(),
	pageSize: z.coerce.number().int().positive().max(50).optional(),
	status: llmLogStatusSchema.optional(),
	callType: z.string().min(1).optional(),
	provider: z.string().min(1).optional(),
	model: z.string().min(1).optional(),
});

export const getLlmLogSchema = z.object({
	id: z.number().int().positive(),
});

export const updateAiModelSchema = z
	.object({
		id: z.number().int().positive(),
		modelId: z.string().min(1).optional(),
		displayName: z.string().min(1).optional(),
		contextWindow: z.number().int().positive().nullable().optional(),
		maxOutputTokens: z.number().int().positive().nullable().optional(),
		inputCostPerMillion: z.number().nonnegative().nullable().optional(),
		outputCostPerMillion: z.number().nonnegative().nullable().optional(),
		thinkingEffortLevels: thinkingEffortLevelsSchema.optional(),
		defaultThinkingEffort: thinkingEffortLevelSchema.nullable().optional(),
		thinkingEnabled: z.boolean().nullable().optional(),
		thinkingParamName: z.string().nullable().optional(),
		enabled: z.boolean().optional(),
		metadata: z.string().nullable().optional(),
		requestParams: coercedRequestParamsFieldSchema,
	})
	.superRefine(refineThinkingEffortDefault);

const aiSettingsSchema = z.object({
	defaultModelId: z.number().int().positive().nullable(),
	agentModels: z.record(z.string(), z.number().int().positive().nullable()),
});

export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const setDefaultModelSchema = z.object({
	modelId: z.number().int().positive(),
});

export const setAgentModelSchema = z.object({
	agent: z.enum(AI_AGENT_TASKS),
	modelId: z.number().int().positive().nullable(),
});

export const testConnectionInputSchema = z.object({
	modelId: z.number().int().positive(),
});

export const testModelBenchmarkInputSchema = z.object({
	modelId: z.number().int().positive(),
});

export function agentModelConfigKey(agent: AiAgentTask): string {
	return `agent.${agent}.model_id`;
}

export function resolveThinkingEffort(
	levels: ThinkingEffortLevel[],
	defaultLevel: ThinkingEffortLevel | null | undefined,
): ThinkingEffortLevel | undefined {
	if (!defaultLevel || levels.length === 0) return undefined;
	return levels.includes(defaultLevel) ? defaultLevel : undefined;
}

export function toProviderConfig(
	config: ResolvedModelConfig | ProviderConfig,
): ProviderConfig {
	const thinkingEffort =
		"thinkingEffortLevels" in config
			? resolveThinkingEffort(
					config.thinkingEffortLevels,
					config.defaultThinkingEffort,
				)
			: config.thinkingEffort;

	return {
		model: config.model,
		baseUrl: config.baseUrl,
		apiKey: config.apiKey,
		thinkingEffort,
		thinkingEnabled:
			"thinkingEnabled" in config
				? (config.thinkingEnabled ?? undefined)
				: undefined,
		thinkingParamName:
			"thinkingParamName" in config
				? (config.thinkingParamName ?? undefined)
				: undefined,
		requestParams:
			"requestParams" in config && config.requestParams
				? config.requestParams
				: undefined,
	};
}

export const ingestQuestionSchema = z.preprocess((input) => {
	const normalized = preprocessLegacyQuestionInput(input);
	if (typeof normalized !== "object" || normalized === null) {
		return normalized;
	}

	const answers = readAnswers(normalized);
	if (answers.length === 0) return normalized;

	return {
		...normalized,
		options: normalizeIngestOptions(
			"options" in normalized ? normalized.options : undefined,
			answers,
		),
	};
}, questionSchema);

export const examIngestResponseSchema = z.preprocess(
	normalizeExamIngestResponse,
	z.object({
		examName: z.string().min(1, "Exam name is required"),
		questions: z.array(ingestQuestionSchema),
		topics: z.array(z.string()),
	}),
);

export type ExamIngestResponse = z.infer<typeof examIngestResponseSchema>;

export const attemptSchema = z.object({
	questionId: z.number().int().positive(),
	userAnswer: z.string().min(1),
	userAnswers: z.array(z.string()).optional(),
	correct: z.boolean(),
	credit: z.number().min(0).max(1).optional(),
});

export const memorySessionSchema = z.object({
	examName: z.string(),
	topic: z.string(),
	totalQuestions: z.number().int().positive(),
	correctAnswers: z.number().min(0),
	duration: z.number().optional(),
	questions: z.array(
		z.preprocess(
			(input) => {
				if (typeof input !== "object" || input === null) return input;
				const answers = readAnswers(input);
				if (answers.length === 0) return input;
				const { correctAnswer: _correctAnswer, ...rest } = input as Record<
					string,
					unknown
				>;
				return { ...rest, correctAnswers: answers };
			},
			z.object({
				question: z.string(),
				userAnswer: z.string(),
				correctAnswers: z.array(z.string()).min(1),
				isCorrect: z.boolean(),
				explanation: z.string(),
				topic: z.string(),
			}),
		),
	),
});
