# Task-C-001 Report

## Status: DONE

## Files Created

1. **`src/features/ai/jobs/generate-exam/generate-questions.ts`** — LLM-based question generation module
   - Accepts `GenerateExamGenerationContext` + model + userId + jobId
   - Uses `generateObject` with Zod schema for structured output
   - System prompt in Portuguese for objective (multiple choice) question generation
   - Handles transient LLM errors with up to 2 retries (same pattern as `parse-context-file.ts`)
   - Uses `createLlmLogCallId`, `logLlmCallStart`, `logLlmCallComplete` for audit
   - Returns `{ ok: true, questions: unknown[], usage?: TokenUsage }` or `{ ok: false, terminal: JobErrorBody }`

2. **`src/features/ai/jobs/generate-exam/run-generate-exam.ts`** — Orchestrator for the generate-exam job
   - Follows the complete flow: validate job → reading_context → parsing_context_files → generating_questions → persisting
   - Emits phase events as text via `JobEventAppender`
   - Checks `isCancelRequested` between phases
   - Retries question generation up to 2 times if not enough valid questions
   - Uses `persistQuestions` from ingest module for persistence
   - All-or-nothing: fails with `NO_VALID_QUESTIONS` if persisted < questionCount

3. **`docs/tasks/0033-geracao-provas-por-conteudo/Task-C-001/log-task.sh`** — Task logging wrapper

## Files Modified

4. **`src/features/ai/jobs/run-job-consumer.ts`** — Added `JOB_KIND.GENERATE_EXAM` case
   - Parses metadata with `parseGenerateExamJobMetadata`
   - Creates `JobEventAppender`
   - Calls `runGenerateExam()` with appropriate deps
   - Follows same pattern as `IMPROVE_QUESTIONS` case

## Test Results

- `src/functions/jobs/create-generate-exam-job.test.ts` — 4 tests passed
- `src/functions/jobs/upload-generate-exam-context.test.ts` — 5 tests passed
- `src/features/ai/jobs/generate-exam/` — 4 test files, 14 tests passed
- Typecheck: no errors from new/modified files
- Biome: clean on all files

## Concerns

- `storeParsedArtifact()` and `buildReadContextDeps()` use a custom `R2BucketLike` type that is incompatible with Cloudflare's `R2Bucket`. Used `as never` casts at call sites. This is a pre-existing issue in those modules.
- The `run-job-consumer.ts` has a pre-existing unused import (`serializeImproveQuestionsJobMetadata`) that was not introduced by this task.
- No unit tests were created for the new modules (`generate-questions.ts`, `run-generate-exam.ts`) — these would require mocking the AI SDK and are left for Task-D-001.

## Commits

No commits created yet (awaiting user instruction).
