import { createFileRoute } from "@tanstack/react-router";
import { handleChatPost } from "./-handlers";

export const Route = createFileRoute("/api/chat/")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) =>
				handleChatPost(request),
		},
	},
} as never);
