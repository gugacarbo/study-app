import { createFileRoute } from "@tanstack/react-router";
import { createAuthFromBindings, getAuthBindings } from "@/lib/auth";

async function handleAuthRequest(request: Request) {
	const env = await getAuthBindings();
	const auth = createAuthFromBindings(env);
	return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) =>
				handleAuthRequest(request),
			POST: async ({ request }: { request: Request }) =>
				handleAuthRequest(request),
		},
	},
} as never);
