# DB Layer

Drizzle ORM + D1 (SQLite), 10 tables. `DBQueries` class assembled via `Object.assign` mixin.

## Structure

| Module      | Files | Purpose                                        |
| ----------- | ----- | ---------------------------------------------- |
| `schema.ts` | 1     | Drizzle table definitions                      |
| `queries/`  | 12    | `DBQueries` class + standalone query functions |

## Query Modules

| File                | Purpose                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `base.ts`           | `DBQueries` class + interface                                                                   |
| `types.ts`          | TypeScript interfaces (`ExamRecord`, `ExamDetail`, `QuestionListItem`, `PaginatedResult`, etc.) |
| `helpers.ts`        | Pagination utilities                                                                            |
| `exams.ts`          | Exam CRUD + paged listing                                                                       |
| `questions.ts`      | Question CRUD + random fetch                                                                    |
| `questions-list.ts` | Paged question/answer-key listing with filters                                                  |
| `attempts.ts`       | Attempt session management (create, answer, refresh)                                            |
| `attempts-stats.ts` | Stats aggregation (exam-level + global)                                                         |
| `files.ts`          | File metadata CRUD                                                                              |
| `config.ts`         | Key-value config store (upsert)                                                                 |
| `ai-providers.ts`   | AI provider CRUD (base URL + encrypted API key)                                                 |
| `ai-models.ts`      | AI model catalog CRUD (cost, context, provider FK)                                              |
| `llm-logs.ts`       | LLM call logging (upsert with `ON CONFLICT`)                                                    |
| `memory.ts`         | **Stub** — `getMemoryStats` returns zeros                                                       |

## Conventions

- **Object.assign mixin** — `queries/index.ts` assigns standalone functions onto `DBQueries.prototype`. Requires `biome-ignore suppress` for declaration merging.
- **Dual query patterns** — Drizzle ORM for standard CRUD/pagination. Raw D1 prepared statements for UPSERT (`ON CONFLICT`) and complex CTE aggregations.
- **JSON storage** — `options` columns hold string arrays as JSON, parsed on read at query boundaries.
- **snake_case ↔ camelCase** — SQL columns are `snake_case`, TypeScript types are `camelCase`. Mapped at query boundaries.
- **R2 + D1 hybrid** — `r2_key` columns reference external R2 objects; `search_text` fields hold lightweight searchable text.

## Note

`memory.ts` is a stub (`getMemoryStats` returns all zeros). Real memory stats aggregation lives in `lib/memory.ts`.
