import { z } from "zod";

export const llmLogsFiltersSchema = z.object({
	userId: z.string().optional(),
	status: z.enum(["pending", "success", "error"]).optional(),
	provider: z.string().optional(),
	model: z.string().optional(),
	callType: z.string().optional(),
	dateFrom: z.string().optional(),
	dateTo: z.string().optional(),
});

export type LlmLogsFilters = z.infer<typeof llmLogsFiltersSchema>;
