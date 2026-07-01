# Task-A-001 Report: Atualizar tipos e schemas para suportar explanation por alternativa

## Status: DONE

## 1. What was implemented

Added optional `explanation: string | null | undefined` field to `QuestionOption` type and all three Zod schemas that validate/parse question options. This is the type-level foundation for per-alternative explanations in the improve-question pipeline.

### Changes by file

| File | Change |
|------|--------|
| `src/features/exams/types/exam-detail.ts` | Added `explanation?: string \| null` to `QuestionOption` |
| `src/features/exams/lib/question-form-schema.ts` | Added `explanation: z.string().trim().max(1000).optional().nullable()` to `questionOptionSchema` |
| `src/features/exams/lib/parse-question-fields.ts` | Added `explanation: z.string().trim().max(1000).optional().nullable()` to `optionSchema` |
| `src/features/ai/jobs/improve-questions/run-improve-question-agent.ts` | Added `explanation: z.string().trim().max(1000).optional().nullable()` to the option object inside `questionSnapshotSchema` |

No files created or deleted.

## 2. What was tested and results

- `npm run typecheck` — ✅ exit 0, no type errors

## 3. Files changed

- `src/features/exams/types/exam-detail.ts` — 1 line changed
- `src/features/exams/lib/question-form-schema.ts` — 1 line added
- `src/features/exams/lib/parse-question-fields.ts` — 1 line added
- `src/features/ai/jobs/improve-questions/run-improve-question-agent.ts` — 1 line added

## 4. Self-review findings

- `QuestionImprovementSnapshot` in `question-improvement-drafts.ts:8` uses `Array<{ key: string; text: string }>` (inline type), not `QuestionOption[]`. This is structurally compatible — the assignment `options: question.options` (where `question.options` is `QuestionOption[]`) succeeds because `explanation` is optional. No change needed.
- All schemas use `.optional().nullable()` so `undefined`, `null`, and omitted values all parse correctly — full backward compatibility.
- Max length constraint is consistently 1000 characters across all schemas.
- All fields use `.trim()` and `.max(1000)` consistent with existing patterns.

## 5. Issues or concerns

None. Acceptance criteria fully met.
