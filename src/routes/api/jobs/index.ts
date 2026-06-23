import { createFileRoute } from "@tanstack/react-router";
import { createIngestJobHandler } from "@/functions/jobs/create-ingest-job";
import { createImproveQuestionsJobHandler } from "@/functions/jobs/create-improve-questions-job";

export const Route = createFileRoute("/api/jobs/")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				const body = (await request.json()) as { kind?: string };
				if (body?.kind === "improve-questions") {
					return createImproveQuestionsJobHandler(body, request.headers);
				}
				return createIngestJobHandler(body, request.headers);
			},
		},
	},
} as never);
