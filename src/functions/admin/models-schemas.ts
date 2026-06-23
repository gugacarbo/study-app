import { z } from "zod";

export const listModelsSchema = z.object({
	providerId: z.string().uuid(),
});

export const upsertModelSchema = z.object({
	providerId: z.string().uuid(),
	modelId: z.string().trim().min(1),
	displayName: z.string().trim().min(1),
	contextWindow: z.number().int().positive().optional().nullable(),
	maxOutputTokens: z.number().int().positive().optional().nullable(),
	inputCostPerMillion: z.number().optional().nullable(),
	outputCostPerMillion: z.number().optional().nullable(),
	thinkingEffortLevels: z.string().optional().nullable(),
	defaultThinkingEffort: z.string().optional().nullable(),
	thinkingEnabled: z.boolean().optional().nullable(),
	thinkingParamName: z.string().optional().nullable(),
	enabled: z.boolean().optional(),
	metadata: z.string().optional().nullable(),
	requestParams: z.string().optional().nullable(),
});

export const deleteModelSchema = z.object({
	id: z.string().uuid(),
});

export const setDefaultModelSchema = z.object({
	modelId: z.string().uuid().nullable(),
});

export const testModelSchema = z.object({
	id: z.string().uuid(),
	modelId: z.string().trim().min(1).optional(),
	timeoutMs: z.number().int().positive().max(300000).optional(),
	prompt: z.string().trim().min(1).optional(),
	reasoningEffort: z.string().trim().min(1).nullable().optional(),
});
