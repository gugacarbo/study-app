import { createFileRoute } from "@tanstack/react-router";
import { uploadIngestFileHandler } from "@/functions/jobs/upload-ingest-file";

export const Route = createFileRoute("/api/jobs/$id/upload")({
	server: {
		handlers: {
			POST: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => uploadIngestFileHandler(params.id, request, request.headers),
		},
	},
} as never);
