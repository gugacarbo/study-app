# Tests

Vitest v4 + jsdom. 3 test files across 2 directories.

## Inventory

| File                              | What it tests                      | Libs Used                            |
| --------------------------------- | ---------------------------------- | ------------------------------------ |
| `lib/validation.test.ts`          | Zod schemas (ingest, config, quiz) | `vitest`                             |
| `server-functions/config.test.ts` | Config DB queries                  | `vitest`, `#/db/queries` mock        |
| `server-functions/quiz.test.ts`   | Quiz DB queries + AI mock          | `vitest`, `#/db/queries`, `#/lib/ai` |

## Conventions
- **Path alias:** Imports use `#/` prefix (e.g., `#/db/queries`, `#/lib/validation`)
- **D1 mock factory:** Each server-fn test defines `createMockDB()` — returns a mock `D1Database` with chained `.prepare().bind().run()/first()/all()` stubs
- **AI mocking:** `vi.mock('#/lib/ai')` with async factory for `extractQuestionsFromText`, `getExplanation`, `generateQuizQuestions`
- **File naming:** `*.test.ts` (not `.spec.ts`)
- **No test setup file** — no `setupFiles` in vitest config

## What's NOT Tested
- No component tests (despite `@testing-library/react` being installed)
- No E2E tests (no Playwright)
- No route integration tests
- No coverage reporting configured
