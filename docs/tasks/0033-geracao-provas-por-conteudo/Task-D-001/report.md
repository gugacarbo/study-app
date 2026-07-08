# Task-D-001 Report: Tests for Generate Exam Feature

## Status: DONE

## Summary

Created 4 new test files covering the generate-exam feature end-to-end, from the UI form through the orchestrator to the monitor layer.

## Test Files Created

| File | Tests | Status |
|------|-------|--------|
| `src/features/exams/components/generate-exam-form.spec.tsx` | 12 | ✅ All pass |
| `src/features/ai/jobs/generate-exam/generate-questions.test.ts` | 9 | ✅ All pass |
| `src/features/ai/jobs/generate-exam/run-generate-exam.test.ts` | 11 | ✅ All pass |
| `src/features/background-processes/lib/generate-exam-monitor.test.ts` | 17 | ✅ All pass |

## Test Coverage

### 1. `generate-exam-form.spec.tsx` (12 tests)
- Renders all fields: title, mainContent, questionCount, difficulty, difficultyNotes, contextFiles
- Title auto-suggestion from markdown heading in mainContent
- Title auto-suggestion from first non-empty line
- Title auto-suggestion from first attached filename
- Title fallback to empty when no content or files
- Title stops auto-updating after manual edit
- Validates questionCount range (1-20)
- Validates context file extensions (.txt/.md only)
- Validates max 5 context files
- Shows validation errors when form is invalid
- Enables submit when form is valid
- Calls submit with form data on valid submission

### 2. `generate-questions.test.ts` (9 tests)
- Returns `ok: true` with questions array when LLM succeeds
- Returns `ok: false` with MODEL_UNAVAILABLE when getAiModel throws
- Retries on transient errors (429) and succeeds on retry
- Retries on transient errors (5xx) and succeeds on retry
- Retries on timeout errors and succeeds on retry
- Returns `ok: false` after exhausting retries on persistent errors
- Returns `ok: false` when LLM returns empty questions array
- Logs LLM calls via logLlmCallStart/logLlmCallComplete on success
- Logs LLM calls on error (after model resolution succeeds)

### 3. `run-generate-exam.test.ts` (11 tests)
- Fails when job not found
- Fails when job kind is not GENERATE_EXAM
- Fails when job status is not QUEUED or RUNNING
- Fails when metadata is invalid
- Fails when readContext returns error
- Fails when parseContextFile returns error for any file
- Fails when storeParsedArtifact returns error
- Fails when generateQuestions fails after all retries
- Fails when persisted count < questionCount (NO_VALID_QUESTIONS)
- Completes successfully with correct status and metadata
- Checks isCancelRequested between phases and cancels when requested

### 4. `generate-exam-monitor.test.ts` (17 tests)
- `GENERATE_EXAM_PHASE_LABELS` has all 4 phases with correct labels
- `isGenerateExamEvent` correctly identifies generate-exam events (all 4 phases)
- `isGenerateExamEvent` returns false for null, non-object, wrong type, missing data, invalid phase
- `mapGenerateExamProgress` returns initial progress for empty events
- `mapGenerateExamProgress` returns correct progress for each phase
- `mapGenerateExamProgress` tracks phase progression through multiple events
- `mapGenerateExamProgress` ignores non-generate-exam events

## Quality Gates

| Gate | Result |
|------|--------|
| `pnpm exec biome check` | ✅ Fixed (3 files auto-fixed) |
| `pnpm exec vitest run` (all generate-exam tests) | ✅ 34/34 passed |
| `npm run docs-check` | ✅ 0 errors, 0 warnings |

## Concerns

None. All tests pass and all quality gates are green.
