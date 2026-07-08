import { createFileRoute } from "@tanstack/react-router";
import { createDb } from "@/db/client";
import { getJobById } from "@/db/queries/jobs";
import { requireDB } from "@/functions/db";
import { uploadGenerateExamContextHandler } from "@/functions/jobs/upload-generate-exam-context";
import { uploadIngestFileHandler } from "@/functions/jobs/upload-ingest-file";
import { JOB_KIND } from "@/lib/job-kinds";
import { requireSession } from "@/lib/rbac";

export const Route = createFileRoute("/api/jobs/$id/upload")({
	server: {
		handlers: {
			POST: async ({
				request,
				params,
			}: {
				request: Request;
				params: { id: string };
			}) => {
				const headers = request.headers;
				const session = await requireSession(headers);
				const db = createDb(await requireDB());
				const job = await getJobById(db, params.id, session.user.id);

				if (!job) {
					return new Response(JSON.stringify({ error: "Job not found" }), {
						status: 404,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (job.kind === JOB_KIND.GENERATE_EXAM) {
					return uploadGenerateExamContextHandler(params.id, request, headers);
				}

				if (job.kind === JOB_KIND.INGEST) {
					return uploadIngestFileHandler(params.id, request, headers);
				}

				return new Response(
					JSON.stringify({
						error: `Unsupported job kind for upload: ${job.kind}`,
					}),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			},
		},
	},
} as never);
