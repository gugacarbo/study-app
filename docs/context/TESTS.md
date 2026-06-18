# Testes — Study App

## Runner

Vitest v4 + jsdom. Config: `vitest.config.ts`. Comando: `npm test` (`vitest run`).

Aliases: `@/` → `src/`. Sem `setupFiles` global obrigatório. Sem coverage. Sem E2E.

## Layout

**Colocado ao lado do código** — não há espelho global `tests/`.

```
src/functions/exams/list.test.ts
src/features/quiz/components/quiz.spec.tsx
src/db/queries/exams.test.ts
src/lib/auth-allowed-email-domain.test.ts
```

## Naming (importante)

| Sufixo       | Uso                                     |
| ------------ | --------------------------------------- |
| `*.test.ts`  | Lógica, functions, agents, lib, queries |
| `*.spec.tsx` | Componentes React                       |

Vitest **exclui** `**/*.test.tsx` — component tests devem ser `.spec.tsx`.

## Mocks

**D1:** mock por arquivo — chain `prepare().bind().run()/first()/all()`. Suportar `.raw()` para compat Drizzle.

**Auth:** mock `getSession` / `requireSession` em `functions/auth/`.

**AI:** mock módulos em `src/features/ai/` ou `fetch` para streams.

**React:** `@testing-library/react` + `vi.hoisted()` + `vi.mock` para Query/Store.

## O que testar / não testar

- Schemas Zod, streams, agents, function handlers, stores
- UI com `.spec.tsx` colocado na feature
- Não há Miniflare nem D1 real nos testes
- CI não roda testes ainda — validação local + `npm run typecheck`

## DoD ao alterar testes

```bash
npm test
npm run typecheck
```

Inventário de suites relevantes: `src/features/ai/AGENTS.md` ou AGENTS da feature quando existir.
