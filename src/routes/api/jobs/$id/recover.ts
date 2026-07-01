import { createFileRoute } from "@tanstack/react-router";
import { recoverStaleJobHandler } from "@/functions/jobs/recover-job";

export const Route = createFileRoute("/api/jobs/$id/recover")({
	server: {
		handlers: {
			POST: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => recoverStaleJobHandler(params.id, request.headers, { now: new Date() }),
		},
	},
} as never);
