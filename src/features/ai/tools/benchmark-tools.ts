import { tool, zodSchema, type ToolSet } from "ai";
import { z } from "zod";

const MAX_DELAY_MS = 500;

const addNumbersInputSchema = z.object({
	a: z.number(),
	b: z.number(),
});

const echoInputSchema = z.object({
	message: z.string(),
});

const delayMsInputSchema = z.object({
	ms: z.number().int().nonnegative(),
});

export function createBenchmarkTools(): ToolSet {
	return {
		add_numbers: tool({
			description:
				"Add integers a and b. Returns { sum: a + b }. Call once, then report the sum from the tool result.",
			inputSchema: zodSchema(addNumbersInputSchema),
			execute: async ({ a, b }) => ({ sum: a + b }),
		}),
		echo: tool({
			description:
				"Echo a message unchanged. Returns { message }. Call once, then cite message in your reply.",
			inputSchema: zodSchema(echoInputSchema),
			execute: async ({ message }) => ({ message }),
		}),
		delay_ms: tool({
			description:
				"Wait for the specified number of milliseconds (capped server-side).",
			inputSchema: zodSchema(delayMsInputSchema),
			execute: async ({ ms }) => {
				const waitedMs = Math.min(ms, MAX_DELAY_MS);
				await new Promise((resolve) => {
					setTimeout(resolve, waitedMs);
				});
				return { waitedMs };
			},
		}),
	};
}
