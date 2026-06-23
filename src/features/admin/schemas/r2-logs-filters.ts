import { z } from "zod";

export const r2LogsFiltersSchema = z.object({
	userId: z.string().optional(),
	status: z.enum(["success", "error"]).optional(),
	bucket: z.string().optional(),
	operation: z.enum(["get", "put", "delete", "head", "list"]).optional(),
	dateFrom: z.string().optional(),
	dateTo: z.string().optional(),
});

export type R2LogsFilters = z.infer<typeof r2LogsFiltersSchema>;
