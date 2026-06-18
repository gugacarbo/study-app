import { z } from "zod";

const baseUrlSchema = z.string().trim().url("URL inválida");

export const createProviderFormSchema = z.object({
	name: z.string().trim().min(1, "Nome obrigatório"),
	baseUrl: baseUrlSchema,
	apiKey: z.string().trim().min(1, "API key obrigatória"),
	enabled: z.boolean(),
});

export const editProviderFormSchema = z.object({
	name: z.string().trim().min(1, "Nome obrigatório"),
	baseUrl: baseUrlSchema,
	apiKey: z.string().optional(),
	enabled: z.boolean(),
});

export type CreateProviderFormValues = z.infer<typeof createProviderFormSchema>;
export type EditProviderFormValues = z.infer<typeof editProviderFormSchema>;
