import { createFileRoute } from "@tanstack/react-router";
import { retryQuestionHandler } from "@/functions/jobs/retry-question";

export const Route = createFileRoute("/api/jobs/$id/questions/$questionId/retry")({
	server: {
		handlers: {
			POST: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string; questionId: string };
			}) => retryQuestionHandler(params.id, params.questionId, request.headers),
		},
	},
} as never);
