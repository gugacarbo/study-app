import { createFileRoute } from "@tanstack/react-router";
import { listActiveJobsHandler } from "@/functions/jobs/list-active-jobs";

export const Route = createFileRoute("/api/jobs/active")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) =>
				listActiveJobsHandler(request.headers),
		},
	},
} as never);
