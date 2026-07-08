import { createFileRoute } from "@tanstack/react-router";
import { cancelQuestionHandler } from "@/functions/jobs/cancel-question";

export const Route = createFileRoute("/api/jobs/$id/questions/$questionId/cancel")({
	server: {
		handlers: {
			POST: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string; questionId: string };
			}) => cancelQuestionHandler(params.id, params.questionId, request.headers),
		},
	},
} as never);
