import { createFileRoute } from "@tanstack/react-router";
import { cancelJobHandler } from "@/functions/jobs/cancel-job";

export const Route = createFileRoute("/api/jobs/$id/cancel")({
	server: {
		handlers: {
			POST: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => cancelJobHandler(params.id, request.headers),
		},
	},
} as never);
