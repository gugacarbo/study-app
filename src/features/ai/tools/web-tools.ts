import { type ToolSet, tool, zodSchema } from "ai";
import { z } from "zod";
import type {
	WebContentProvider,
	WebFetchResponse,
	WebSearchProvider,
	WebSearchResponse,
} from "@/features/ai/providers/web/types";

const TOOL_ERROR_CODE = "TOOL_EXECUTION_FAILED";

export interface WebToolsObserver {
	onSearch?: (payload: {
		input: { query: string; maxResults: number };
		output: WebSearchResponse;
	}) => void | Promise<void>;
	onFetch?: (payload: {
		input: { url: string; maxChars: number };
		output: WebFetchResponse;
	}) => void | Promise<void>;
	onWarning?: (message: string) => void | Promise<void>;
}

export function createWebTools(
	searchProvider: WebSearchProvider,
	contentProvider: WebContentProvider,
	observer?: WebToolsObserver,
): ToolSet {
	return {
		web_search: tool({
			description:
				"Search the web for external factual context and return source links.",
			inputSchema: zodSchema(
				z.object({
					query: z.string().min(2),
					maxResults: z.coerce.number().int().min(1).max(8).default(5),
				}),
			),
			execute: async (input) => {
				try {
					const data = await searchProvider.search({
						query: input.query,
						maxResults: Number(input.maxResults),
					});
					await observer?.onSearch?.({
						input: {
							query: input.query,
							maxResults: Number(input.maxResults),
						},
						output: data,
					});
					return { ok: true as const, data };
				} catch (error) {
					await observer?.onWarning?.(
						error instanceof Error ? error.message : "web_search failed",
					);
					return {
						ok: false as const,
						error: {
							code: TOOL_ERROR_CODE,
							message: "Unable to search the web right now.",
						},
					};
				}
			},
		}),
		web_fetch: tool({
			description: "Fetch the main content from a URL for direct reading.",
			inputSchema: zodSchema(
				z.object({
					url: z.string().url(),
					maxChars: z.coerce.number().int().min(500).max(20_000).default(8_000),
				}),
			),
			execute: async (input) => {
				try {
					const data = await contentProvider.fetchContent({
						url: input.url,
						maxChars: Number(input.maxChars),
					});
					await observer?.onFetch?.({
						input: {
							url: input.url,
							maxChars: Number(input.maxChars),
						},
						output: data,
					});
					return { ok: true as const, data };
				} catch (error) {
					await observer?.onWarning?.(
						error instanceof Error ? error.message : "web_fetch failed",
					);
					return {
						ok: false as const,
						error: {
							code: TOOL_ERROR_CODE,
							message: "Unable to fetch page content right now.",
						},
					};
				}
			},
		}),
	};
}
