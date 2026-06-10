# Testes — Study App

## Runner

Vitest v4 + jsdom. Config: `vitest.config.ts`. Comando: `npm test` (`vitest run`).

Aliases: `@/` e `#/` → `src/`. Sem `setupFiles` global. Sem coverage. Sem E2E.

## Layout

Espelha `src/` sob `tests/` — não colocado ao lado do source.

```
tests/
├── lib/
├── server-functions/
├── routes/
├── components/      # *.spec.tsx
├── features/ai/
└── stores/
```

## Naming (importante)

| Sufixo       | Uso                             |
| ------------ | ------------------------------- |
| `*.test.ts`  | Lógica, server fns, agents, lib |
| `*.spec.tsx` | Componentes React               |

Vitest **exclui** `**/*.test.tsx` — component tests devem ser `.spec.tsx`.

## Mocks

**D1:** `createMockDB()` por arquivo — chain `prepare().bind().run()/first()/all()`. Suportar `.raw()` para compat Drizzle (`tests/db.queries.pagination.test.ts` usa `FakeDrizzle`).

**AI:** `vi.mock('@tanstack/ai')` ou mock de módulos em `src/features/ai/`. Stream: mock `fetch` ou helpers de stream.

**React:** `@testing-library/react` + `vi.hoisted()` + `vi.mock` para Query/Store.

## O que testar / não testar

- Schemas Zod, pipelines SSE, agents, server-fn handlers, stores
- UI de ingest/quiz/exams com `.spec.tsx`
- Não há Miniflare nem D1 real nos testes
- CI não roda testes ainda — validação local + `npm run typecheck`

## DoD ao alterar testes

```bash
npm test
npm run typecheck
```

Atualizar inventário em `tests/AGENTS.md` se adicionar suite nova relevante.
