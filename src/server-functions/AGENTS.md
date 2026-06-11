# Server Functions

**Last updated:** 2026-06-11

TanStack Start `createServerFn`. Toda mutação/query server-side passa por aqui.

## Inventory

| File / dir           | Exports                                                                   | Método                     |
| -------------------- | ------------------------------------------------------------------------- | -------------------------- |
| `config.ts`          | `getConfig`, `setConfig`                                                  | GET / POST                 |
| `llm-logs.ts`        | `listLlmLogs`, `getLlmLog`                                                | GET / POST                 |
| `stats.ts`           | `getStats`, `getExams`                                                    | GET                        |
| `quiz.ts`            | `generateQuiz`, `submitAnswer`, `listQuizAttempts`, `abandonQuizAttempts` | POST                       |
| `memory.ts`          | `saveQuizSessionToMemory`, `getMemoryContext`, `getMemoryOverview`        | GET / POST                 |
| `exams/detail.ts`    | `getExamDetail`, `getExamsDetailed`                                       | GET                        |
| `exams/delete.ts`    | `deleteExam`                                                              | POST                       |
| `exams/update.ts`    | `updateExam`                                                              | POST                       |
| `exams/questions.ts` | `updateQuestion`                                                          | POST                       |
| `exams/generate.ts`  | `generateExamQuestionExplanations`                                        | POST                       |
| `exams/index.ts`     | re-exports do subdir                                                      | —                          |
| `db.ts`              | `getDB`                                                                   | **util** — não é server fn |
| `storage.ts`         | `getFilesBucket`, `getMemoryBucket`                                       | **util** — não é server fn |

## Patterns

- Input: Zod + `inputValidator` (`src/lib/validation.ts`)
- DB: `getDB()` → `DBQueries` (`src/db/queries/`)
- R2: `getFilesBucket()` / `getMemoryBucket()` em `storage.ts`
- Memória: `src/lib/memory/`
- IA: `src/features/ai/` (agents, `core/generate`, `chat-stream`)

## Rules

- `db.ts` e `storage.ts` — server-only; nunca importar de componentes client
- Chaves de API nunca no bundle client — config via D1
- Novas funções: um export por operação, validação Zod obrigatória para input de usuário
