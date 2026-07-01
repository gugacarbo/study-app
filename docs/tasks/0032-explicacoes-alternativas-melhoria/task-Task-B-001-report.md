# Task-B-001 Report: Adicionar writeOptionExplanations no pipeline do job

## Status: DONE

## 1. What was implemented

Added `writeOptionExplanations` flag through the entire job pipeline:

| Layer | File | Change |
|-------|------|--------|
| **Metadata type** | `src/lib/job-kinds.ts` | Added `writeOptionExplanations: boolean` to `ImproveQuestionsJobMetadata` + parser default (false) |
| **Schema** | `src/functions/jobs/create-improve-questions-job.ts` | Added `writeOptionExplanations?: z.boolean()` to `createImproveQuestionsJobSchema` + pass to metadata serialization |
| **Client API** | `src/features/exams/lib/improve-questions-api.ts` | Added `writeOptionExplanations?: boolean` to input type and POST body |
| **Hook** | `src/features/exams/hooks/use-improve-questions-job.ts` | Added `writeOptionExplanations?: boolean` to submit input type |
| **Dialog** | `src/features/exams/components/exam-improve-questions-dialog.tsx` | Added state, Switch UI (label: "Explicar alternativas incorretas"), included in submit payload |
| **Batch runner** | `src/features/ai/jobs/improve-questions/run-improve-questions-batch.ts` | Added `writeOptionExplanations?: boolean` to `executeQuestion` deps type + pass from metadata |
| **Consumer** | `src/features/ai/jobs/run-job-consumer.ts` | Destructures `writeOptionExplanations` from deps (agent wiring deferred to Task-B-002) |

## 2. What was tested and results

- `npm run typecheck` → exit 0
- 5 relevant test files pass (13 tests):
  - `src/features/ai/jobs/improve-questions/run-improve-questions-batch.test.ts` (3/3)
  - `src/features/ai/jobs/run-job-consumer.test.ts` (1/1)
  - `src/features/background-processes/lib/improve-event-mapper.test.ts` (1/1)
  - `src/functions/jobs/create-improve-questions-job.test.ts` (5/5)
  - `src/functions/jobs/reconcile-stale-jobs.test.ts` (3/3)
- Component tests pass:
  - `src/features/exams/components/exam-improve-questions-dialog.spec.tsx` (2/2)
  - `src/features/background-processes/components/improve-questions-progress-panel.spec.tsx` (3/3)

Pre-existing test failures (7 files, 16 tests) in unrelated code remain unchanged.

## 3. Files changed

### Explicitly modified (Task-B-001 scope):

| File | Change type |
|------|------------|
| `src/lib/job-kinds.ts` | Add field to type + parser |
| `src/functions/jobs/create-improve-questions-job.ts` | Add field to schema + metadata |
| `src/features/exams/lib/improve-questions-api.ts` | Add field to input + body |
| `src/features/exams/hooks/use-improve-questions-job.ts` | Add field to submit input |
| `src/features/exams/components/exam-improve-questions-dialog.tsx` | Add state + switch + payload |
| `src/features/ai/jobs/improve-questions/run-improve-questions-batch.ts` | Add field to deps + pass from metadata |
| `src/features/ai/jobs/run-job-consumer.ts` | Destructure field in deps callback |

### Test files updated (for type compatibility):

| File | Change |
|------|--------|
| `src/features/ai/jobs/improve-questions/run-improve-questions-batch.test.ts` | Add field to mock metadata + assertion |
| `src/features/ai/jobs/run-job-consumer.test.ts` | Add field to mock metadata |
| `src/features/background-processes/components/improve-questions-progress-panel.spec.tsx` | Add field to mock metadata (3 instances) |
| `src/features/background-processes/lib/improve-event-mapper.test.ts` | Add field to mock metadata |
| `src/functions/jobs/create-improve-questions-job.test.ts` | Add field to mock metadata (2 instances) |
| `src/functions/jobs/reconcile-stale-jobs.test.ts` | Add field to mock metadata |
| `src/features/exams/components/exam-improve-questions-dialog.spec.tsx` | Add field to assertion |

## 4. Self-review findings

- `writeOptionExplanations` is **not** passed to `runImproveQuestionAgent` in the consumer — the agent function doesn't accept this parameter yet (it's Task-B-002's scope). The flag is destructured and acknowledged via `void _writeOptionExplanations` to satisfy linting. This follows the task's instruction that agent wiring is deferred.

## 5. Issues or concerns

None. All acceptance criteria are met, typecheck passes, relevant tests pass.
