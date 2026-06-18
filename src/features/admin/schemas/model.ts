import { z } from "zod";

export const modelFormSchema = z.object({
	modelId: z.string().trim().min(1, "ID do modelo obrigatório"),
	displayName: z.string().trim().min(1, "Nome obrigatório"),
	enabled: z.boolean(),
});

export type ModelFormValues = z.infer<typeof modelFormSchema>;
