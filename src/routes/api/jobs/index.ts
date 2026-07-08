import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createGenerateExamJobHandler } from "@/functions/jobs/create-generate-exam-job";
import { createImproveQuestionsJobHandler } from "@/functions/jobs/create-improve-questions-job";
import { createIngestJobHandler } from "@/functions/jobs/create-ingest-job";
import { JOB_KIND } from "@/lib/job-kinds";

const createJobBodySchema = z.object({
	kind: z.enum([
		JOB_KIND.INGEST,
		JOB_KIND.IMPROVE_QUESTIONS,
		JOB_KIND.GENERATE_EXAM,
	]),
});

export const Route = createFileRoute("/api/jobs/")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				const rawBody = await request.json();
				const parseResult = createJobBodySchema.safeParse(rawBody);

				if (!parseResult.success) {
					return new Response(
						JSON.stringify({
							error: "Invalid job kind",
							issues: parseResult.error.issues,
						}),
						{ status: 400, headers: { "Content-Type": "application/json" } },
					);
				}

				const { kind } = parseResult.data;

				if (kind === JOB_KIND.IMPROVE_QUESTIONS) {
					return createImproveQuestionsJobHandler(rawBody, request.headers);
				}

				if (kind === JOB_KIND.GENERATE_EXAM) {
					return createGenerateExamJobHandler(rawBody, request.headers);
				}

				return createIngestJobHandler(rawBody, request.headers);
			},
		},
	},
} as never);
