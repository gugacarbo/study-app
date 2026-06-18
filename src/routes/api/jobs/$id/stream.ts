import { createFileRoute } from "@tanstack/react-router";
import { streamJobEventsHandler } from "@/functions/jobs/stream-job-events";

export const Route = createFileRoute("/api/jobs/$id/stream")({
	server: {
		handlers: {
			GET: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => streamJobEventsHandler(params.id, request, request.headers),
		},
	},
} as never);
