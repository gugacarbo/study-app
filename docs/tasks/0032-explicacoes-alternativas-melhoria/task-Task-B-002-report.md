# Task-B-002 Report: Atualizar agente de melhoria para gerar explanations por alternativa

**Status:** DONE

## 1. What was implemented

### `src/features/ai/jobs/improve-questions/run-improve-question-agent.ts`

1. **Added `writeOptionExplanations?: boolean` to the function input type** (line 91) — the `runImproveQuestionAgent` function now accepts the optional flag to control whether per-option explanations should be generated.

2. **Updated `buildPrompt` to accept the flag** (line 58) — the function signature changed from `buildPrompt(questionId: string)` to `buildPrompt(questionId: string, writeOptionExplanations?: boolean)`.

3. **Conditional prompt instruction** (lines 68-77) — when `writeOptionExplanations` is `true`, the instruction `"Also generate an explanation for each option explaining why it is correct or incorrect in the context of the question. Each explanation must be at most 1000 characters."` is inserted **before** the "Persist the final improved question by calling update_question_draft exactly once." line, using `findIndex` to locate the target line robustly.

4. **Passes `writeOptionExplanations` to `buildPrompt`** (line 320) — the call site now passes `input.writeOptionExplanations`.

### `src/features/ai/jobs/run-job-consumer.ts`

5. **Wire the flag through** — replaced the `void _writeOptionExplanations;` no-op with `writeOptionExplanations: _writeOptionExplanations` in the `runImproveQuestionAgent` call, and fixed the indentation of the `return` statement.

## 2. What was tested and test results

- **Typecheck:** `npm run typecheck` → **exit 0** (no errors)
- **Agent tests:** `npm test -- --run src/features/ai/jobs/improve-questions/run-improve-question-agent.test.ts` → **2/2 passed**
- **Full test suite:** Pre-existing failures in unrelated test files (run-ingest mocks, question-edit-form labels, job-monitor-page timing). Zero new failures introduced.

## 3. Files changed

| File | Change |
|------|--------|
| `src/features/ai/jobs/improve-questions/run-improve-question-agent.ts` | Added `writeOptionExplanations` parameter to input type and `buildPrompt`; conditional prompt instruction |
| `src/features/ai/jobs/run-job-consumer.ts` | Passes `writeOptionExplanations` from batch runner to `runImproveQuestionAgent` |

## 4. Self-review findings

- The prompt instruction is inserted before the "Persist the final" line using `findIndex`, which is more robust than a hardcoded index — it correctly positions regardless of future prompt reordering.
- The existing `questionSnapshotSchema.options` already has `explanation` (added by Task-A-001), so no schema changes were needed.
- The flag is optional (`writeOptionExplanations?: boolean`), so existing callers (e.g., tests) that don't pass it continue to work unchanged — the agent simply won't add the extra prompt instruction.
- The max length constraint (1000 chars) is enforced both in the prompt instruction and in the Zod schema.

## 5. Issues or concerns

None. All acceptance criteria are met:
- ✅ `runImproveQuestionAgent` accepts `writeOptionExplanations?: boolean`
- ✅ `buildPrompt` conditionally adds the option explanations instruction
- ✅ Agent generates options with `explanation` in snapshot when flag is true (schema already supports it)
- ✅ `npm run typecheck` passes
- ✅ Consumer passes the flag through
