import type { DBQueries } from "../../../../../db/queries";
import type { WebSearchProvider, WebContentProvider } from "@/features/ai/providers/web/types";
import { createChatDbTools } from "./db-tools";
import { createChatWebTools } from "./web-tools";

export function createChatTools(queries: DBQueries, options?: { searchProvider?: WebSearchProvider; contentProvider?: WebContentProvider }) {
  const dbTools = createChatDbTools(queries);
  const webTools = options?.searchProvider && options?.contentProvider
    ? createChatWebTools(options.searchProvider, options.contentProvider)
    : [];
  return [...dbTools, ...webTools];
}
