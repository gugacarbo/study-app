import { z } from "zod";

export const formFieldsSchema = z.object({
	provider: z.enum(["openrouter", "openai", "groq", "ollama", "custom"]),
	model: z.string().min(1, "Model is required"),
	baseUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
	apiKey: z.string(),
});

export type FormFieldsValues = z.infer<typeof formFieldsSchema>;
