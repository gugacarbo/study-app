# Task-D-001 Report: Updated tests and final verification

## 1. What I implemented

- **New agent test**: Added a 3rd test (`"includes the option explanation instruction in the prompt and persists explanations when writeOptionExplanations is true"`) to `src/features/ai/jobs/improve-questions/run-improve-question-agent.test.ts`. This test:
  - Seeds a question with options
  - Calls `runImproveQuestionAgent` with `writeOptionExplanations: true`
  - Mocks `streamText` to call `update_question_draft` with options that include `explanation`
  - Verifies the prompt contains `"Also generate an explanation for each option explaining why it is correct or incorrect"`
  - Verifies the draft is persisted with per-option explanations intact
  - Follows the same pattern as the 2 existing tests

- **Fixed edit form tests** in `src/features/exams/components/question-edit-form.spec.tsx`:
  - **"shows and hides a per-field text diff"**: Changed `do enunciado` → `no enunciado` in both `getByRole` queries (the DiffToggle label preposition changed from "do" to "no" in a previous task)
  - **"keeps diff visibility independent between fields"**: Changed from using stale `diffToggles[1]` reference (which became detached after first click's re-render) to querying `screen.getByRole("button", { name: /ver diff na explicação/i })` directly. Also updated the `getByRole` assertion to use the specific `"Ocultar diff na explicação"` text.

## 2. Test results

| Command | Result |
|---|---|
| `npm run typecheck` | ✅ exit 0 |
| `npm test -- --run src/features/ai/jobs/improve-questions/run-improve-question-agent.test.ts` | ✅ 3/3 passed |
| `npm test -- --run src/features/exams/components/exam-improve-questions-dialog.spec.tsx` | ✅ 2/2 passed |
| `npm test -- --run src/features/exams/components/question-edit-form.spec.tsx` | ✅ 19/19 passed |
| `npm test` (full suite) | ⚠️ 607/619 passed, 12 pre-existing failures in unrelated files |
| `npm run docs-check` | ✅ 0 errors (after `npm run docs-check:update`) |

The 12 pre-existing test failures are in:
- `cron.test.ts` (3) — console.log/console.warn mocking issues
- `job-monitor-page.spec.tsx` (1) — layout/rendering issue
- `exam-question-item.spec.tsx` (1) — badge rendering issue
- `run-ingest.test.ts` (7) — `db.query.questionTopics` undefined (infrastructure)

None of these are caused by my changes.

## 3. Files changed

- `src/features/ai/jobs/improve-questions/run-improve-question-agent.test.ts` — Added 3rd test for `writeOptionExplanations: true`
- `src/features/exams/components/question-edit-form.spec.tsx` — Fixed label mismatch (`do` → `no`) and stale DOM element reference
- `docs/tasks/0032-explicacoes-alternativas-melhoria/task-Task-D-001-report.md` — This report

## 4. Self-review findings

**Agent test**: The new test verifies both the prompt instruction AND the persisted per-option explanations. It uses `toMatchObject` for the draft shape plus explicit `expect` on each option's `explanation` from the parsed `improvedSnapshot.options`.

**Dialog test**: Already had `writeOptionExplanations: false` in the assertion at line 122 (from Task-B-001). Passes as-is.

**Edit form test**: Two pre-existing failures were caused by:
1. The DiffToggle label preposition changed from `"do enunciado"` to `"no enunciado"` in a previous task (Task-C-001 likely), but the test wasn't updated
2. The test used a stale DOM element reference (`diffToggles[1]`). After clicking `diffToggles[0]`, React's re-render replaced DOM nodes, making `diffToggles[1]` point to a detached element. The fix re-queries the element by its accessible name.

## 5. Issues or concerns

- The 12 pre-existing test failures across 4 test files were present before this task and are unrelated to the explanations-per-alternativa feature
- `docs/index.json` and `docs/specs/README.md` had drifted from the actual docs; fixed via `npm run docs-check:update`
