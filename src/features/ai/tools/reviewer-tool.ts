import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import { runParallelReview } from "@/features/ai/agents/reviewer";
import type { ProviderConfig } from "@/lib/validation";
import type { AgentToolSet } from "./tool-registry";

const TOOL_ERROR_CODE = "TOOL_EXECUTION_FAILED";

interface ParallelReviewToolOptions {
	reviewerTools?: AgentToolSet;
	onWarning?: (message: string) => void | Promise<void>;
}

const parallelReviewDef = toolDefinition({
	name: "parallel_review",
	description:
		"Run 3 parallel reviewers plus one arbiter for fact-checking and return a consolidated answer with sources.",
	inputSchema: z.object({
		question: z.string().min(2),
		reviewerCount: z.coerce.number().int().min(2).max(5).default(3),
	}),
	outputSchema: z.union([
		z.object({
			ok: z.literal(true),
			data: z.object({
				answer: z.string(),
				confidence: z.string(),
				conflictNotes: z.string().optional(),
				sources: z.array(z.string()),
				reviewerDrafts: z.array(z.object({
					verdict: z.string(),
					answer: z.string(),
					reasoning: z.string(),
					confidence: z.string(),
					sources: z.array(z.string()),
				})),
				failedReviewerCount: z.number().int().min(0).default(0),
			}),
		}),
		z.object({
			ok: z.literal(false),
			error: z.object({
				code: z.literal(TOOL_ERROR_CODE),
				message: z.string(),
			}),
		}),
	]),
});

export function createParallelReviewTool(
	providerConfig: ProviderConfig,
	options?: ParallelReviewToolOptions,
) {
	return parallelReviewDef.server(async (input) => {
		try {
			const result = await runParallelReview(providerConfig, input.question, {
				reviewerCount: Number(input.reviewerCount),
				tools: options?.reviewerTools,
			});
			return {
				ok: true as const,
				data: result,
			};
		} catch (error) {
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
	});
}
