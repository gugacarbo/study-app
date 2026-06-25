import { createFileRoute } from "@tanstack/react-router";
import { isGoogleAuthEnabled } from "@/lib/auth";

export const Route = createFileRoute("/api/auth/google-status")({
	server: {
		handlers: {
			GET: async () =>
				Response.json({
					enabled: await isGoogleAuthEnabled(),
				}),
		},
	},
} as never);
