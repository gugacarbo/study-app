# Tests

**Last updated:** 2026-06-10

Vitest v4 + jsdom. ~30 arquivos. Detalhe → `docs/context/TESTS.md`.

## Naming

- `*.test.ts` — lógica, routes, server-functions, agents
- `*.spec.tsx` — componentes React (**obrigatório**; `*.test.tsx` é excluído pelo vitest)

## Inventory (por área)

| Área                            | Arquivos                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `lib/`                          | validation, sse-stream, ingest-stream, generate, chat-db-tools                                                           |
| `server-functions/`             | config, quiz                                                                                                             |
| `routes/`                       | exams.ingest, api/ingest-\*-stage, ingest-extraction-pass                                                                |
| `components/`                   | ingest (output-panel, ingest-chat-view), quiz (quiz, results, hooks), exams-view, explanation-dialog, chat-message-utils |
| `features/ai/`                  | agents (ingest review, explanations), tools, core/agent-stream-handler                                                   |
| `stores/`                       | ingestStore                                                                                                              |
| `db.queries.pagination.test.ts` | FakeDrizzle pagination                                                                                                   |

## Conventions

- Imports: `@/` ou `#/` (ambos mapeados no vitest)
- D1: `createMockDB()` local com `.bind().raw()` quando Drizzle exige
- AI: `vi.mock('@tanstack/ai')` ou mock de módulo específico
- React: `@testing-library/react` + `vi.hoisted()` para mocks de Query/Store
- Sem E2E, sem coverage, sem setup global

## What's NOT tested

- Workers runtime real / Miniflare
- Deploy / wrangler integration
- Fluxos E2E completos no browser
