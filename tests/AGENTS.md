# Tests

**Last updated:** 2026-06-15

Vitest v4 + jsdom. ~30 arquivos. Detalhe → `docs/context/TESTS.md`.

## Naming

- `*.test.ts` — lógica, routes, server-functions, agents
- `*.spec.tsx` — componentes React (**obrigatório**; `*.test.tsx` é excluído pelo vitest)

## Inventory (por área)

| Área                            | Arquivos                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `lib/`                          | validation, generate, chat-db-tools                                                                                      |
| `server-functions/`             | config, quiz                                                                                                             |
| `routes/`                       | exams.ingest, api/ingest-\*-stage, ingest-extraction-pass                                                                |
| `components/`                   | ingest (output-panel, ingest-chat-view), quiz (quiz, results, hooks), exams-view, chat-message-utils |
| `features/ai/`                  | agents (ingest review, explanations), adapters/provider-model, tools, core/ai-stream-handler, lib/read-job-ui-message-stream |
| `stores/`                       | ingestStore                                                                                                              |
| `db.queries.pagination.test.ts` | FakeDrizzle pagination                                                                                                   |

## Conventions

- Imports: `@/` ou `#/` (ambos mapeados no vitest)
- D1: `createMockDB()` local com `.bind().raw()` quando Drizzle exige
- AI: mock `ai` SDK modules or specific `src/features/ai/` helpers
- React: `@testing-library/react` + `vi.hoisted()` para mocks de Query/Store
- Sem E2E, sem coverage, sem setup global

## What's NOT tested

- Workers runtime real / Miniflare
- Deploy / wrangler integration
- Fluxos E2E completos no browser
