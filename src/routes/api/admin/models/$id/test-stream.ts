import { createFileRoute } from "@tanstack/react-router";
import { streamModelProbeHandler } from "@/functions/admin/stream-model-probe";

export const Route = createFileRoute("/api/admin/models/$id/test-stream")({
	server: {
		handlers: {
			POST: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => streamModelProbeHandler(params.id, request, request.headers),
		},
	},
} as never);
