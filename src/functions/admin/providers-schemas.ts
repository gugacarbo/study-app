import { z } from "zod";
import { normalizeBaseUrl } from "@/functions/admin/helpers";

const baseUrlSchema = z
	.string()
	.url()
	.transform((value) => normalizeBaseUrl(value.trim()));

export const createProviderSchema = z.object({
	name: z.string().trim().min(1),
	baseUrl: baseUrlSchema,
	apiKey: z.string().trim().min(1),
	enabled: z.boolean().optional(),
});

export const updateProviderSchema = z.object({
	id: z.string().uuid(),
	name: z.string().trim().min(1).optional(),
	baseUrl: baseUrlSchema.optional(),
	apiKey: z.string().optional(),
	enabled: z.boolean().optional(),
});

export const deleteProviderSchema = z.object({ id: z.string().uuid() });

export const testProviderSchema = z.union([
	z.object({ id: z.string().uuid() }),
	z.object({ baseUrl: baseUrlSchema, apiKey: z.string().trim().min(1) }),
]);

export const discoverModelsSchema = z.object({
	providerId: z.string().uuid(),
});
