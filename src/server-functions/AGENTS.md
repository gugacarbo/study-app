# Server Functions

Server-side functions using TanStack Start's `createServerFn`. 7 files.

## Inventory

| File | Exports | Type |
|---|---|---|
| `config.ts` | `getConfig`, `setConfig`, `testConnection` | `createServerFn` (GET/POST) |
| `ingest.ts` | `ingestExam` | `createServerFn` (POST) |
| `quiz.ts` | `generateQuiz`, `submitAnswer` | `createServerFn` (POST) |
| `stats.ts` | `getStats`, `getExams` | `createServerFn` (GET) |
| `exams.ts` | `getExamDetail`, `getExamsDetailed`, `deleteExam` | `createServerFn` (GET/POST) |
| `obsidian.ts` | 7 functions (status, save, export, search, config) | `createServerFn` |
| `db.ts` | `getDB` | **NOT a server fn** — utility helper |

## Patterns
- **Input validation:** Zod schemas passed via `inputValidator` (from `src/lib/validation.ts`)
- **D1 access:** All DB fns import `getDB` from `./db.ts` which resolves the `D1Database` binding
- **AI calls:** Via `src/lib/ai/` module (ai.ts core, prompts/extract-questions, prompts/generate-quiz, prompts/explain-answer)
- **Obsidian calls:** Via `src/lib/obsidian.ts` REST client
- **Environment:** Server-only by default — never importable from client

## Rules
- `db.ts` is a utility, not a server fn — don't import it from client code
- All AI calls must go through server functions (never directly from components)
- Use `inputValidator` with Zod for all user-facing inputs
