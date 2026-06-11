import { tool, zodSchema, type Tool, type ToolSet } from "ai";
import { z } from "zod";
import { runParallelReview } from "@/features/ai/agents/reviewer";
import type { ProviderConfig } from "@/lib/validation";

const TOOL_ERROR_CODE = "TOOL_EXECUTION_FAILED";

interface ParallelReviewToolOptions {
	reviewerTools?: ToolSet;
	onWarning?: (message: string) => void | Promise<void>;
}

const parallelReviewInputSchema = z.object({
	question: z.string().min(2),
	reviewerCount: z.coerce.number().int().min(2).max(5).default(3),
});

export function createParallelReviewTool(
	providerConfig: ProviderConfig,
	options?: ParallelReviewToolOptions,
): Tool {
	return tool({
		description:
			"Run 3 parallel reviewers plus one arbiter for fact-checking and return a consolidated answer with sources.",
		inputSchema: zodSchema(parallelReviewInputSchema),
		execute: async (input) => {
			try {
				const result = await runParallelReview(providerConfig, input.question, {
					reviewerCount: Number(input.reviewerCount),
					tools: options?.reviewerTools as NonNullable<
						Parameters<typeof runParallelReview>[2]
					>["tools"],
				});
				return {
					ok: true as const,
					data: result,
				};
			} catch (error) {
				console.error("parallel_review failed:", error);
				const message =
					error instanceof Error ? error.message : "Unknown reviewer error";
				await options?.onWarning?.(`parallel_review failed: ${message}`);
				return {
					ok: false as const,
					error: {
						code: TOOL_ERROR_CODE,
						message: "Unable to run parallel review right now.",
					},
				};
			}
		},
	});
}
