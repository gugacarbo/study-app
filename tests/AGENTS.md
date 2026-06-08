# Tests

<!-- Last updated: 2026-06-08 -->

Vitest v4 + jsdom. 15+ test files across 6 directories.

## Inventory

| File                                                         | What it tests                                           | Libs Used                                     |
| ------------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------- |
| `lib/validation.test.ts`                                     | Zod schemas (ingest, config, quiz)                      | `vitest`                                       |
| `lib/sse-stream.test.ts`                                     | SSE stream types                                        | `vitest`                                       |
| `lib/ingest-stream.test.ts`                                  | Ingest SSE dispatch helpers                             | `vitest`                                       |
| `server-functions/config.test.ts`                            | Config DB queries                                       | `vitest`, `#/db/queries` mock                  |
| `server-functions/quiz.test.ts`                              | Quiz DB queries + AI mock                               | `vitest`, `#/db/queries`, `#/lib/ai`           |
| `stores/ingestStore.test.ts`                                 | Ingest job store (create, update, complete)             | `vitest`                                       |
| `routes/exams.ingest.test.ts`                                | Ingest route handler                                    | `vitest`                                       |
| `routes/api/ingest-extraction-pass.test.ts`                  | Extraction pass tools                                   | `vitest`                                       |
| `components/ingest/output-panel.spec.tsx`                    | Output panel rendering                                  | `vitest`, `@testing-library/react`             |
| `components/ingest/ingest-chat-view.spec.tsx`                | Chat view UI (bubbles, rounds, status)                  | `vitest`, `@testing-library/react`             |
| `features/ai/agents/ingest/review-extraction/review-question.test.ts` | Review extraction agent                    | `vitest`                                       |
| `features/ai/tools/ingest-extraction-workspace.test.ts`      | Extraction workspace                                    | `vitest`                                       |
| `features/ai/tools/ingest-tools.test.ts`                     | Extraction tool creation                                | `vitest`                                       |

## Conventions
- **Path alias:** Imports use `#/` prefix (e.g., `#/db/queries`, `#/lib/validation`)
- **D1 mock factory:** Each server-fn test defines `createMockDB()` — returns a mock `D1Database` with chained `.prepare().bind().run()/first()/all()` stubs
- **AI mocking:** `vi.mock('#/lib/ai')` with async factory for `extractQuestionsFromText`, `getExplanation`, `generateQuizQuestions`
- **File naming:** `*.test.ts` (not `.spec.ts`)
- **No test setup file** — no `setupFiles` in vitest config

## What's NOT Tested
- No E2E tests (no Playwright)
- No coverage reporting configured
