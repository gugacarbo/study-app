diff --git a/src/features/admin/lib/job-labels.ts b/src/features/admin/lib/job-labels.ts
index ba9d00f..3f631bc 100644
--- a/src/features/admin/lib/job-labels.ts
+++ b/src/features/admin/lib/job-labels.ts
@@ -10,6 +10,7 @@ export const JOB_KIND_LABELS: Record<JobKind, string> = {
 	[JOB_KIND.INGEST]: "Ingestão",
 	[JOB_KIND.EXPLAIN_QUESTION]: "Explicação",
 	[JOB_KIND.IMPROVE_QUESTIONS]: "Melhoria",
+	[JOB_KIND.GENERATE_EXAM]: "Geração de prova",
 	[JOB_KIND.CONNECTION_TEST]: "Teste de conexão",
 	[JOB_KIND.MODEL_BENCHMARK]: "Benchmark",
 };
diff --git a/src/lib/job-errors.ts b/src/lib/job-errors.ts
index 9b22b7b..6777b66 100644
--- a/src/lib/job-errors.ts
+++ b/src/lib/job-errors.ts
@@ -12,6 +12,8 @@ export const JOB_ERROR_CODE = {
 	JOB_NOT_FOUND: "job_not_found",
 	JOB_NOT_AWAITING_UPLOAD: "job_not_awaiting_upload",
 	INVALID_JOB_KIND: "invalid_job_kind",
+	INVALID_CONTEXT_PARSE: "invalid_context_parse",
+	CONTEXT_PARSE_FAILED: "context_parse_failed",
 } as const;
 
 export type JobErrorCode = (typeof JOB_ERROR_CODE)[keyof typeof JOB_ERROR_CODE];
diff --git a/src/lib/job-kinds.ts b/src/lib/job-kinds.ts
index 9b554b2..45625aa 100644
--- a/src/lib/job-kinds.ts
+++ b/src/lib/job-kinds.ts
@@ -2,6 +2,7 @@ export const JOB_KIND = {
 	INGEST: "ingest",
 	EXPLAIN_QUESTION: "explain-question",
 	IMPROVE_QUESTIONS: "improve-questions",
+	GENERATE_EXAM: "generate-exam",
 	CONNECTION_TEST: "connection-test",
 	MODEL_BENCHMARK: "model-benchmark",
 } as const;
@@ -72,9 +73,10 @@ export function canManuallyCancelJobStatus(status: string): boolean {
 	);
 }
 
-export function statusBadgeVariant(
-	status: string,
-): { variant: "secondary" | "destructive" | "outline"; className: string } {
+export function statusBadgeVariant(status: string): {
+	variant: "secondary" | "destructive" | "outline";
+	className: string;
+} {
 	switch (status) {
 		case JOB_STATUS.COMPLETED:
 			return {
@@ -138,6 +140,44 @@ export type IngestJobMetadata = {
 	reviewWarning?: "review_fallback";
 };
 
+export const GENERATE_EXAM_PHASE = {
+	READING_CONTEXT: "reading_context",
+	PARSING_CONTEXT_FILES: "parsing_context_files",
+	GENERATING_QUESTIONS: "generating_questions",
+	PERSISTING: "persisting",
+} as const;
+
+export type GenerateExamPhase =
+	(typeof GENERATE_EXAM_PHASE)[keyof typeof GENERATE_EXAM_PHASE];
+
+export const GENERATE_EXAM_DIFFICULTY = {
+	EASY: "easy",
+	MEDIUM: "medium",
+	HARD: "hard",
+} as const;
+
+export type GenerateExamDifficulty =
+	(typeof GENERATE_EXAM_DIFFICULTY)[keyof typeof GENERATE_EXAM_DIFFICULTY];
+
+export type GenerateExamJobMetadata = {
+	examId: string;
+	modelId: string;
+	questionCount: number;
+	difficulty: GenerateExamDifficulty;
+	difficultyNotes?: string;
+	fileIds?: string[];
+	parsedContextArtifactIds?: string[];
+	parsedContextCount?: number;
+	extractedCount?: number;
+	persistedCount?: number;
+	skippedDuplicateCount?: number;
+	invalidCount?: number;
+	inputTokens?: number;
+	outputTokens?: number;
+	totalTokens?: number;
+	cost?: number;
+};
+
 export const IMPROVE_QUESTIONS_DEFAULT_CONCURRENCY = 2;
 
 export const IMPROVE_BATCH_PHASE = {
@@ -212,6 +252,74 @@ export function serializeIngestJobMetadata(
 	return JSON.stringify(metadata);
 }
 
+function isGenerateExamDifficulty(
+	value: unknown,
+): value is GenerateExamDifficulty {
+	return (
+		typeof value === "string" &&
+		(Object.values(GENERATE_EXAM_DIFFICULTY) as readonly string[]).includes(
+			value,
+		)
+	);
+}
+
+function isStringArray(value: unknown): value is string[] {
+	return (
+		Array.isArray(value) && value.every((item) => typeof item === "string")
+	);
+}
+
+export function parseGenerateExamJobMetadata(
+	raw: string | null,
+): GenerateExamJobMetadata | null {
+	if (!raw) return null;
+	try {
+		const parsed = JSON.parse(raw) as Partial<GenerateExamJobMetadata>;
+		if (
+			typeof parsed !== "object" ||
+			parsed == null ||
+			typeof parsed.examId !== "string" ||
+			typeof parsed.modelId !== "string" ||
+			typeof parsed.questionCount !== "number" ||
+			!isGenerateExamDifficulty(parsed.difficulty) ||
+			(typeof parsed.difficultyNotes !== "string" &&
+				typeof parsed.difficultyNotes !== "undefined") ||
+			(typeof parsed.fileIds !== "undefined" &&
+				!isStringArray(parsed.fileIds)) ||
+			(typeof parsed.parsedContextArtifactIds !== "undefined" &&
+				!isStringArray(parsed.parsedContextArtifactIds)) ||
+			(typeof parsed.parsedContextCount !== "number" &&
+				typeof parsed.parsedContextCount !== "undefined") ||
+			(typeof parsed.extractedCount !== "number" &&
+				typeof parsed.extractedCount !== "undefined") ||
+			(typeof parsed.persistedCount !== "number" &&
+				typeof parsed.persistedCount !== "undefined") ||
+			(typeof parsed.skippedDuplicateCount !== "number" &&
+				typeof parsed.skippedDuplicateCount !== "undefined") ||
+			(typeof parsed.invalidCount !== "number" &&
+				typeof parsed.invalidCount !== "undefined") ||
+			(typeof parsed.inputTokens !== "number" &&
+				typeof parsed.inputTokens !== "undefined") ||
+			(typeof parsed.outputTokens !== "number" &&
+				typeof parsed.outputTokens !== "undefined") ||
+			(typeof parsed.totalTokens !== "number" &&
+				typeof parsed.totalTokens !== "undefined") ||
+			(typeof parsed.cost !== "number" && typeof parsed.cost !== "undefined")
+		) {
+			return null;
+		}
+		return parsed as GenerateExamJobMetadata;
+	} catch {
+		return null;
+	}
+}
+
+export function serializeGenerateExamJobMetadata(
+	metadata: GenerateExamJobMetadata,
+): string {
+	return JSON.stringify(metadata);
+}
+
 export function parseImproveQuestionsJobMetadata(
 	raw: string | null,
 ): ImproveQuestionsJobMetadata | null {
