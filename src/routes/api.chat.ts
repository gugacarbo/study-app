import { createFileRoute } from "@tanstack/react-router";
import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { createOpenaiChatCompletions } from "@tanstack/ai-openai";
import { getDB } from "../server-functions/db";
import { DBQueries } from "../db/queries";
import type { ModelMessage } from "@tanstack/ai";

export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = (await request.json()) as {
					messages: { role: string; content: string }[];
				};

				const db = await getDB();
				if (!db) {
					return new Response("D1 database not available", { status: 500 });
				}

				const queries = new DBQueries(db);
				const config = await queries.getAllConfig();
				const model = config.ai_model || "openai/gpt-4o-mini";
				const apiKey = config.ai_api_key;
				const provider = config.ai_provider || "openrouter";
				const baseUrl =
					config.ai_base_url ||
					(provider === "openrouter"
						? "https://openrouter.ai/api/v1"
						: undefined);

				if (!apiKey) {
					return new Response("AI provider not configured", { status: 400 });
				}

				const adapter = createOpenaiChatCompletions(model as any, apiKey, {
					baseURL: baseUrl,
				});

				const stream = chat({
					adapter,
					messages: body.messages as Array<ModelMessage>,
				});

				return toServerSentEventsResponse(stream);
			},
		},
	},
});
