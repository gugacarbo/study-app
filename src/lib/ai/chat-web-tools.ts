import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import type { WebContentProvider } from "./web-content-provider";
import type { WebSearchProvider } from "./web-search-provider";

const TOOL_ERROR_CODE = "TOOL_EXECUTION_FAILED";
const TOOL_ERROR_MESSAGE = "Unable to search the web right now. Please try again.";

const webSearchDef = toolDefinition({
	name: "web_search",
	description:
		"Search the web for current or external factual information and return source links.",
	inputSchema: z.object({
		query: z.string().min(2),
		maxResults: z.coerce.number().int().min(1).max(8).default(5),
	}),
	outputSchema: z.union([
		z.object({
			ok: z.literal(true),
			data: z.object({
				query: z.string(),
				results: z.array(
					z.object({
						title: z.string(),
						url: z.string().url(),
						snippet: z.string(),
					}),
				),
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

const webFetchDef = toolDefinition({
	name: "web_fetch",
	description:
		"Fetch the main content from a URL so the assistant can read the source directly.",
	inputSchema: z.object({
		url: z.string().url(),
		maxChars: z.coerce.number().int().min(500).max(20_000).default(8_000),
	}),
	outputSchema: z.union([
		z.object({
			ok: z.literal(true),
			data: z.object({
				url: z.string().url(),
				title: z.string(),
				content: z.string(),
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

export function createChatWebTools(
	searchProvider: WebSearchProvider,
	contentProvider: WebContentProvider,
) {
	const webSearch = webSearchDef.server(async (input) => {
		try {
			const data = await searchProvider.search({
				query: input.query,
				maxResults: Number(input.maxResults),
			});
			return { ok: true as const, data };
		} catch {
			return {
				ok: false as const,
				error: {
					code: TOOL_ERROR_CODE,
					message: TOOL_ERROR_MESSAGE,
				},
			};
		}
	});

	const webFetch = webFetchDef.server(async (input) => {
		try {
			const data = await contentProvider.fetchContent({
				url: input.url,
				maxChars: Number(input.maxChars),
			});
			return { ok: true as const, data };
		} catch {
			return {
				ok: false as const,
				error: {
					code: TOOL_ERROR_CODE,
					message: "Unable to fetch page content right now. Please try again.",
				},
			};
		}
	});

	return [webSearch, webFetch] as const;
}
