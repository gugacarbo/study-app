# Review Package: Task-B-001

**Plan:** 0033-geracao-provas-por-conteudo
**Task:** Task-B-001
**Base:** main
**Head:** working tree

## Commit log (main..HEAD)

```

```

## Diff stat

```
 src/routes/api/jobs/$id/upload.ts | 23 ++++++++++++++++++++++-
 src/routes/api/jobs/index.ts      |  6 +++++-
 2 files changed, 27 insertions(+), 2 deletions(-)

```

## Full diff

```diff
diff --git a/src/routes/api/jobs/$id/upload.ts b/src/routes/api/jobs/$id/upload.ts
index 32c8467..bc4c9c7 100644
--- a/src/routes/api/jobs/$id/upload.ts
+++ b/src/routes/api/jobs/$id/upload.ts
@@ -1,16 +1,37 @@
 import { createFileRoute } from "@tanstack/react-router";
+import { createDb } from "@/db/client";
+import { getJobById } from "@/db/queries/jobs";
+import { requireDB } from "@/functions/db";
+import { uploadGenerateExamContextHandler } from "@/functions/jobs/upload-generate-exam-context";
 import { uploadIngestFileHandler } from "@/functions/jobs/upload-ingest-file";
+import { JOB_KIND } from "@/lib/job-kinds";
+import { requireSession } from "@/lib/rbac";
 
 export const Route = createFileRoute("/api/jobs/$id/upload")({
 	server: {
 		handlers: {
 			POST: async ({
 				request,
 				params,
 			}: {
 				request: Request;
 				params: { id: string };
-			}) => uploadIngestFileHandler(params.id, request, request.headers),
+			}) => {
+				const headers = request.headers;
+				const session = await requireSession(headers);
+				const db = createDb(await requireDB());
+				const job = await getJobById(db, params.id, session.user.id);
+
+				if (!job) {
+					return uploadIngestFileHandler(params.id, request, headers);
+				}
+
+				if (job.kind === JOB_KIND.GENERATE_EXAM) {
+					return uploadGenerateExamContextHandler(params.id, request, headers);
+				}
+
+				return uploadIngestFileHandler(params.id, request, headers);
+			},
 		},
 	},
 } as never);
diff --git a/src/routes/api/jobs/index.ts b/src/routes/api/jobs/index.ts
index 382fae8..362590a 100644
--- a/src/routes/api/jobs/index.ts
+++ b/src/routes/api/jobs/index.ts
@@ -1,17 +1,21 @@
 import { createFileRoute } from "@tanstack/react-router";
-import { createIngestJobHandler } from "@/functions/jobs/create-ingest-job";
+import { createGenerateExamJobHandler } from "@/functions/jobs/create-generate-exam-job";
 import { createImproveQuestionsJobHandler } from "@/functions/jobs/create-improve-questions-job";
+import { createIngestJobHandler } from "@/functions/jobs/create-ingest-job";
 
 export const Route = createFileRoute("/api/jobs/")({
 	server: {
 		handlers: {
 			POST: async ({ request }: { request: Request }) => {
 				const body = (await request.json()) as { kind?: string };
 				if (body?.kind === "improve-questions") {
 					return createImproveQuestionsJobHandler(body, request.headers);
 				}
+				if (body?.kind === "generate-exam") {
+					return createGenerateExamJobHandler(body, request.headers);
+				}
 				return createIngestJobHandler(body, request.headers);
 			},
 		},
 	},
 } as never);

```
