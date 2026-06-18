import { createFileRoute } from "@tanstack/react-router";
import { getJobEventsHandler } from "@/functions/jobs/get-job-events";

export const Route = createFileRoute("/api/jobs/$id/events")({
	server: {
		handlers: {
			GET: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => getJobEventsHandler(params.id, request, request.headers),
		},
	},
} as never);
