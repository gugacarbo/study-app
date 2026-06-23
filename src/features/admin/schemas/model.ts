import { z } from "zod";

export const modelFormSchema = z.object({
	modelId: z.string().trim().min(1, "ID do modelo obrigatório"),
	displayName: z.string().trim().min(1, "Nome obrigatório"),
	enabled: z.boolean(),
	contextWindow: z.union([z.number().int().positive(), z.null()]).optional(),
	maxOutputTokens: z.union([z.number().int().positive(), z.null()]).optional(),
	inputCostPerMillion: z.union([z.number(), z.null()]).optional(),
	outputCostPerMillion: z.union([z.number(), z.null()]).optional(),
	thinkingEffortLevels: z.union([z.string(), z.null()]).optional(),
	defaultThinkingEffort: z.union([z.string(), z.null()]).optional(),
	thinkingEnabled: z.union([z.boolean(), z.null()]).optional(),
	thinkingParamName: z.union([z.string(), z.null()]).optional(),
	metadata: z.union([z.string(), z.null()]).optional(),
	requestParams: z.union([z.string(), z.null()]).optional(),
});

export type ModelFormValues = z.infer<typeof modelFormSchema>;
