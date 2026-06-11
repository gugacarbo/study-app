import { z } from "zod";

export const formFieldsSchema = z.object({
	model: z.string().min(1, "Model is required"),
	baseUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
	apiKey: z.string().optional(),
});

export type FormFieldsValues = z.infer<typeof formFieldsSchema>;
